#!/usr/bin/env node
/**
 * 微信公众号文章解析并保存到 Obsidian
 *
 * 调用内置 wechat_to_md Python 工具解析公众号文章，
 * 自动分类并保存到 Obsidian PARA 目录。
 *
 * 依赖：scripts/ 目录下的 wechat-to-md Python 包
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const SKILL_DIR = __dirname;
const PARA_BASE = 'D:\\MD\\OBSIDIAN\\PARA系统仓库';
const TEMP_OUTPUT = path.join(SKILL_DIR, 'temp_output');

/**
 * 解析公众号文章
 * @param {string} url - 文章链接
 * @returns {object} - 解析结果 {title, content, metadata, imagesDir}
 */
function parseArticle(url) {
    // 清理临时目录
    if (fs.existsSync(TEMP_OUTPUT)) {
        fs.rmSync(TEMP_OUTPUT, { recursive: true });
    }

    // 调用内置 wechat-to-md 解析（先尝试有界面模式，支持验证码）
    const toolPath = path.join(SKILL_DIR, 'scripts', 'main.py');
    let cmd, result;

    try {
        cmd = `py "${toolPath}" "${url}" -o "${TEMP_OUTPUT}" --no-headless`;
        result = execSync(cmd, { encoding: 'utf-8', stdio: 'pipe' });
    } catch (error) {
        // 失败时自动降级到无头模式
        console.log('有界面模式失败，切换到无头模式...');
        cmd = `py "${toolPath}" "${url}" -o "${TEMP_OUTPUT}"`;
        result = execSync(cmd, { encoding: 'utf-8', stdio: 'pipe' });
    }

    // 读取解析结果
    const files = fs.readdirSync(TEMP_OUTPUT);
    const mdFile = files.find(f => f.endsWith('.md'));

    if (!mdFile) {
        throw new Error('未找到解析后的 Markdown 文件，可能遇到验证码或文章已删除');
    }

    const articleDir = path.join(TEMP_OUTPUT, mdFile.replace('.md', ''));
    const mdPath = path.join(articleDir, `${mdFile.replace('.md', '')}.md`);
    const imagesDir = path.join(articleDir, 'images');

    const content = fs.readFileSync(mdPath, 'utf-8');
    const metadata = extractMetadata(content);

    return {
        title: metadata.title || mdFile.replace('.md', ''),
        content: content,
        metadata: metadata,
        imagesDir: fs.existsSync(imagesDir) ? imagesDir : null
    };
}

/**
 * 从 Markdown 内容中提取元数据
 */
function extractMetadata(content) {
    const metadata = {};

    // 提取 YAML frontmatter
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (frontmatterMatch) {
        const frontmatter = frontmatterMatch[1];
        const lines = frontmatter.split('\n');
        for (const line of lines) {
            const match = line.match(/^([^:]+):\s*(.+)$/);
            if (match) {
                metadata[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, '');
            }
        }
    }

    return metadata;
}

/**
 * 根据内容智能分类到 PARA 目录
 */
function classifyArticle(title, content) {
    const lowerTitle = title.toLowerCase();
    const lowerContent = content.toLowerCase();

    const keywords = {
        '产品经理': ['产品经理', 'prd', '需求分析', '用户研究', '交互设计', '原型'],
        'AI产品': ['ai产品', '人工智能', '大模型', 'llm', 'gpt', 'claude', 'agent', 'aigc'],
        '技术开发': ['编程', '开发', '代码', '架构', '算法', '前端', '后端', '数据库'],
        '运维': ['运维', 'devops', 'kubernetes', 'docker', 'ci/cd', '监控', '可观测'],
        '求职': ['简历', '求职', '面试', '招聘', 'offer', '跳槽', '职业规划'],
    };

    for (const [category, words] of Object.entries(keywords)) {
        for (const word of words) {
            if (lowerTitle.includes(word) || lowerContent.includes(word)) {
                if (category === '产品经理') return 'C.领域/产品经理';
                if (category === 'AI产品') return 'C.领域/AI产品';
                if (category === '技术开发') return 'C.领域/技术开发';
                if (category === '运维') return 'C.领域/运维';
                if (category === '求职') return 'C.领域/求职';
            }
        }
    }

    return 'D.资源/文章收藏';
}

/**
 * 保存文章到 Obsidian
 */
function saveToObsidian(article, targetDir) {
    const categoryDir = path.join(PARA_BASE, targetDir);

    // 确保目录存在
    if (!fs.existsSync(categoryDir)) {
        fs.mkdirSync(categoryDir, { recursive: true });
    }

    // 创建文章专属目录
    const safeTitle = article.title.replace(/[<>:"/\\|?*]/g, '_');
    const articleDir = path.join(categoryDir, safeTitle);

    if (!fs.existsSync(articleDir)) {
        fs.mkdirSync(articleDir, { recursive: true });
    }

    // 复制图片
    if (article.imagesDir && fs.existsSync(article.imagesDir)) {
        const targetImagesDir = path.join(articleDir, 'images');
        if (!fs.existsSync(targetImagesDir)) {
            fs.mkdirSync(targetImagesDir, { recursive: true });
        }

        const images = fs.readdirSync(article.imagesDir);
        for (const img of images) {
            fs.copyFileSync(
                path.join(article.imagesDir, img),
                path.join(targetImagesDir, img)
            );
        }
    }

    // 保存 Markdown 文件
    const mdPath = path.join(articleDir, `${safeTitle}.md`);
    fs.writeFileSync(mdPath, article.content, 'utf-8');

    // 清理临时目录
    if (fs.existsSync(TEMP_OUTPUT)) {
        fs.rmSync(TEMP_OUTPUT, { recursive: true });
    }

    return mdPath;
}

/**
 * 主函数
 */
function main() {
    const url = process.argv[2];
    const targetDir = process.argv[3]; // 可选，指定保存目录

    if (!url) {
        console.error('用法: node parse-and-save.js <公众号文章URL> [目标目录]');
        process.exit(1);
    }

    console.log('正在解析文章...');
    const article = parseArticle(url);
    console.log(`标题: ${article.title}`);

    const saveDir = targetDir || classifyArticle(article.title, article.content);
    console.log(`分类: ${saveDir}`);

    const savedPath = saveToObsidian(article, saveDir);
    console.log(`已保存到: ${savedPath}`);
}

// 导出函数供其他模块使用
module.exports = { parseArticle, saveToObsidian, classifyArticle };

// 如果是直接运行
if (require.main === module) {
    main();
}

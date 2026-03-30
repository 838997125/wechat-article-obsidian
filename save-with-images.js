#!/usr/bin/env node
/**
 * 微信公众号文章解析并保存到 Obsidian（带图片下载）
 * 使用浏览器获取文章完整内容，下载图片到本地
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const PARA_BASE = 'D:\\MD\\OBSIDIAN\\PARA系统仓库';

/**
 * 下载图片到本地
 * @param {string} url - 图片URL
 * @param {string} outputPath - 保存路径
 * @returns {Promise<void>}
 */
function downloadImage(url, outputPath) {
    return new Promise((resolve, reject) => {
        const client = url.startsWith('https') ? https : http;
        const request = client.get(url, { timeout: 30000 }, (response) => {
            if (response.statusCode === 301 || response.statusCode === 302) {
                // 重定向
                downloadImage(response.headers.location, outputPath)
                    .then(resolve)
                    .catch(reject);
                return;
            }
            
            if (response.statusCode !== 200) {
                reject(new Error(`下载失败，状态码: ${response.statusCode}`));
                return;
            }

            const file = fs.createWriteStream(outputPath);
            response.pipe(file);
            file.on('finish', () => {
                file.close();
                resolve();
            });
        });

        request.on('error', reject);
        request.on('timeout', () => {
            request.destroy();
            reject(new Error('下载超时'));
        });
    });
}

/**
 * 从HTML内容中提取文章信息
 * @param {string} html - 页面HTML
 * @param {string} url - 文章URL
 * @returns {object} - 文章信息
 */
function extractArticleFromHTML(html, url) {
    // 提取标题
    const titleMatch = html.match(/<h1[^>]*class="rich_media_title[^"]*"[^>]*>([\s\S]*?)<\/h1>/);
    const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : '未命名文章';

    // 提取作者
    const authorMatch = html.match(/<span[^>]*id="js_name"[^>]*>([\s\S]*?)<\/span>/);
    const author = authorMatch ? authorMatch[1].replace(/<[^>]+>/g, '').trim() : '未知作者';

    // 提取发布时间
    const timeMatch = html.match(/<em[^>]*id="publish_time"[^>]*>([\s\S]*?)<\/em>/);
    const publishTime = timeMatch ? timeMatch[1].trim() : '';

    // 提取正文内容
    const contentMatch = html.match(/<div[^>]*id="js_content"[^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<script/);
    let content = contentMatch ? contentMatch[1] : '';

    // 清理微信特有的样式
    content = content.replace(/data-src=/g, 'src=');
    content = content.replace(/style="[^"]*"/g, '');
    content = content.replace(/class="[^"]*"/g, '');
    content = content.replace(/id="[^"]*"/g, '');

    return {
        title,
        author,
        publishTime,
        content,
        url
    };
}

/**
 * 提取所有图片URL
 * @param {string} html - HTML内容
 * @returns {Array<string>} - 图片URL列表
 */
function extractImages(html) {
    const images = [];
    const imgRegex = /<img[^>]+data-src=["']([^"']+)["'][^>]*>/gi;
    let match;
    while ((match = imgRegex.exec(html)) !== null) {
        images.push(match[1]);
    }
    return images;
}

/**
 * 将HTML转换为Markdown
 * @param {string} html - HTML内容
 * @param {string} baseUrl - 用于解析相对URL
 * @returns {string} - Markdown内容
 */
function htmlToMarkdown(html, baseUrl) {
    let md = html;

    // 处理段落
    md = md.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '\n\n$1\n\n');

    // 处理标题
    md = md.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '\n# $1\n');
    md = md.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '\n## $1\n');
    md = md.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '\n### $1\n');
    md = md.replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, '\n#### $1\n');

    // 处理加粗
    md = md.replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, '**$1**');
    md = md.replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, '**$1**');

    // 处理斜体
    md = md.replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, '*$1*');
    md = md.replace(/<i[^>]*>([\s\S]*?)<\/i>/gi, '*$1*');

    // 处理图片 - 将data-src替换为本地路径
    let imgIndex = 0;
    md = md.replace(/<img[^>]+data-src=["']([^"']+)["'][^>]*>/gi, (match, src) => {
        imgIndex++;
        const ext = src.match(/\.(jpg|jpeg|png|gif|webp)(\?|$)/i)?.[1] || 'jpg';
        return `\n![图片${imgIndex}](./images/image_${String(imgIndex).padStart(3, '0')}.${ext})\n`;
    });

    // 处理链接
    md = md.replace(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)');

    // 处理列表
    md = md.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '- $1\n');
    md = md.replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, '\n$1\n');
    md = md.replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, '\n$1\n');

    // 处理换行
    md = md.replace(/<br\s*\/?>/gi, '\n');

    // 移除剩余HTML标签
    md = md.replace(/<[^>]+>/g, '');

    // 解码HTML实体
    md = md.replace(/&nbsp;/g, ' ');
    md = md.replace(/&quot;/g, '"');
    md = md.replace(/&amp;/g, '&');
    md = md.replace(/&lt;/g, '<');
    md = md.replace(/&gt;/g, '>');

    // 清理多余空行
    md = md.replace(/\n{3,}/g, '\n\n');

    return md.trim();
}

/**
 * 根据内容智能分类
 */
function classifyArticle(title, content) {
    const lowerTitle = title.toLowerCase();
    const lowerContent = content.toLowerCase();
    
    const keywords = {
        '产品经理': ['产品经理', 'prd', '需求分析', '用户研究', '交互设计', '原型', '简历', '求职', '面试'],
        'AI产品': ['ai产品', '人工智能', '大模型', 'llm', 'gpt', 'claude', 'agent'],
        '技术开发': ['编程', '开发', '代码', '架构', '算法', '前端', '后端', '数据库'],
        '运维': ['运维', 'devops', 'kubernetes', 'docker', 'ci/cd', '监控', '告警', '可观测'],
    };

    for (const [category, words] of Object.entries(keywords)) {
        for (const word of words) {
            if (lowerTitle.includes(word) || lowerContent.includes(word)) {
                if (category === '产品经理') return 'C.领域/产品经理';
                if (category === 'AI产品') return 'C.领域/AI产品';
                if (category === '技术开发') return 'C.领域/技术开发';
                if (category === '运维') return 'C.领域/运维';
            }
        }
    }

    return 'D.资源/文章收藏';
}

/**
 * 保存文章到 Obsidian
 */
async function saveToObsidian(article, targetDir) {
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

    // 创建图片目录
    const imagesDir = path.join(articleDir, 'images');
    if (!fs.existsSync(imagesDir)) {
        fs.mkdirSync(imagesDir, { recursive: true });
    }

    // 下载图片
    const downloadedImages = [];
    if (article.images && article.images.length > 0) {
        console.log(`发现 ${article.images.length} 张图片，开始下载...`);
        
        for (let i = 0; i < article.images.length; i++) {
            const imgUrl = article.images[i];
            const ext = imgUrl.match(/\.(jpg|jpeg|png|gif|webp)(\?|$)/i)?.[1] || 'jpg';
            const imgName = `image_${String(i + 1).padStart(3, '0')}.${ext}`;
            const imgPath = path.join(imagesDir, imgName);
            
            try {
                await downloadImage(imgUrl, imgPath);
                downloadedImages.push(imgName);
                console.log(`  ✓ 下载图片 ${i + 1}/${article.images.length}: ${imgName}`);
            } catch (error) {
                console.log(`  ✗ 下载失败 ${i + 1}/${article.images.length}: ${error.message}`);
            }
        }
    }

    // 生成 Markdown 内容
    const dateStr = article.publishTime || new Date().toISOString().split('T')[0];
    const frontmatter = `---
title: ${article.title}
author: ${article.author}
source: ${article.url}
date: ${dateStr}
category: ${targetDir.replace(/\//g, '/')}
tags: []
---

`;

    const markdown = frontmatter + article.markdown;

    // 保存 Markdown 文件
    const mdPath = path.join(articleDir, `${safeTitle}.md`);
    fs.writeFileSync(mdPath, markdown, 'utf-8');

    return {
        mdPath,
        imagesDir,
        imageCount: downloadedImages.length
    };
}

/**
 * 主函数
 */
async function main() {
    const url = process.argv[2];
    const targetDir = process.argv[3];
    const htmlContent = process.argv[4]; // 可选，直接传入HTML内容

    if (!url) {
        console.error('用法: node save-with-images.js <公众号文章URL> [目标目录] [HTML内容]');
        process.exit(1);
    }

    console.log('正在解析文章...');
    
    let article;
    if (htmlContent) {
        // 如果提供了HTML内容，直接解析
        const info = extractArticleFromHTML(htmlContent, url);
        const images = extractImages(htmlContent);
        const markdown = htmlToMarkdown(info.content, url);
        
        article = {
            title: info.title,
            author: info.author,
            publishTime: info.publishTime,
            url: info.url,
            content: info.content,
            markdown: markdown,
            images: images
        };
    } else {
        console.error('需要提供HTML内容，请通过浏览器工具获取页面HTML');
        process.exit(1);
    }

    console.log(`标题: ${article.title}`);
    console.log(`作者: ${article.author}`);
    console.log(`图片数: ${article.images.length}`);

    const saveDir = targetDir || classifyArticle(article.title, article.markdown);
    console.log(`分类: ${saveDir}`);

    const result = await saveToObsidian(article, saveDir);
    console.log(`\n✓ 已保存到: ${result.mdPath}`);
    console.log(`✓ 图片保存到: ${result.imagesDir} (${result.imageCount} 张)`);
}

// 导出函数供其他模块使用
module.exports = {
    extractArticleFromHTML,
    extractImages,
    htmlToMarkdown,
    classifyArticle,
    saveToObsidian,
    downloadImage
};

// 如果是直接运行
if (require.main === module) {
    main().catch(console.error);
}

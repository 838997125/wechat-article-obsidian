---
name: wechat-article-obsidian
description: 将微信公众号文章解析为 Markdown 并自动保存到 Obsidian PARA 系统。识别链接 → 解析内容 → 智能分类 → 存入对应目录。
---

# 微信公众号文章 → Obsidian PARA 系统

## 核心能力

将微信公众号文章一键转为 Markdown，自动分类到 Obsidian PARA 目录，本地保存图片，生成标准 Frontmatter。

## 触发方式

用户发送微信公众号文章链接时，自动识别并执行：

```
用户：https://mp.weixin.qq.com/s/xxxxx
用户：帮我保存这篇文章 https://mp.weixin.qq.com/s/xxxxx
用户：解析这个公众号文章并保存到OB
```

## 执行流程

```
收到链接 → 识别为公众号文章 → 解析内容 → 智能分类 → 保存到Obsidian → 汇总结果
```

## 核心脚本

| 脚本 | 用途 |
|------|------|
| `parse-and-save.js` | Node.js 主入口，调用内置 Python 工具 |
| `scripts/main.py` | wechat-to-md CLI，核心解析器 |

## 使用方法

### 推荐：直接发送链接

```
用户: https://mp.weixin.qq.com/s/xxxxx
```

Agent 自动执行以下步骤：
1. 调用 `scripts/main.py` 解析文章（自动降级：先 `--no-headless`，失败则无头模式）
2. 提取标题、作者、发布时间、正文
3. 根据关键词智能分类
4. 下载图片到文章目录
5. 生成带 Frontmatter 的 Markdown 文件
6. 询问用户确认保存路径（或使用自动分类路径）
7. 保存到 `D:\MD\OBSIDIAN\PARA系统仓库/{分类目录}/{文章标题}/`

### 指定保存目录

```
用户：保存这篇文章到 C.领域/AI产品 https://mp.weixin.qq.com/s/xxxxx
```

### 批量处理

```bash
# 创建 URL 列表文件
echo "https://mp.weixin.qq.com/s/xxxxx1" > urls.txt
echo "https://mp.weixin.qq.com/s/xxxxx2" >> urls.txt

# 批量解析
python scripts/main.py -f urls.txt -o ./output -c 10 -v
```

## PARA 智能分类规则

| 分类目录 | 关键词 |
|---------|--------|
| `C.领域/产品经理/` | 产品经理、PRD、需求分析、用户研究、交互设计、原型 |
| `C.领域/AI产品/` | AI产品、人工智能、大模型、LLM、GPT、Claude、Agent、AIGC |
| `C.领域/技术开发/` | 编程、开发、代码、架构、算法、前后端、数据库 |
| `C.领域/运维/` | 运维、DevOps、K8s、Docker、监控、可观测性 |
| `C.领域/求职/` | 简历、求职、面试、招聘、offer、职业规划 |
| `D.资源/文章收藏/` | 其他无法匹配的内容 |

## 微信公众号解析参数

```bash
# 标准解析（自动处理验证码）
python scripts/main.py "<URL>" -o ./output

# 显示浏览器窗口（手动解决验证码）
python scripts/main.py "<URL>" --no-headless

# 跳过图片下载（速度快）
python scripts/main.py "<URL>" --no-images

# 覆盖已存在文件
python scripts/main.py "<URL>" --force

# 调整图片并发数
python scripts/main.py "<URL>" -c 10

# 开启调试日志
python scripts/main.py "<URL>" -v
```

## 依赖说明

### Python 依赖（已内置于 `scripts/`）

```
camoufox[geoip]     # 反检测浏览器（首次自动下载）
markdownify        # HTML → Markdown 转换
beautifulsoup4      # HTML 解析
httpx              # 异步 HTTP + 图片下载
```

首次使用前安装：
```bash
cd scripts
pip install -r requirements.txt
```

### 遇到验证码

微信对频繁访问会触发安全验证。使用 `--no-headless` 参数，手动在弹出的浏览器窗口中完成验证，程序会自动继续。

```bash
python scripts/main.py "<URL>" --no-headless
```

## 输出文件结构

```
D:\MD\OBSIDIAN\PARA系统仓库\
└── C.领域/AI产品/
    └── AI产品经理的三重陷阱/
        ├── AI产品经理的三重陷阱.md    # 主文件（含 Frontmatter）
        └── images/                     # 本地图片目录
            ├── img_001.jpg
            └── img_002.png
```

## Frontmatter 示例

```yaml
---
title: AI产品经理的三重陷阱
author: 产品经理阿钱
date: 2026-03-28 10:30:00
source: https://mp.weixin.qq.com/s/xxxxx
---
```

## 常见错误处理

| 错误 | 原因 | 解决方案 |
|------|------|---------|
| 环境异常/验证码 | 微信触发安全验证 | 使用 `--no-headless` 手动验证 |
| 图片下载失败 | 网络不稳定/图片失效 | 使用 `--force` 重试 |
| 未找到 MD 文件 | 文章已删除或无权限 | 检查 URL 是否有效 |
| Camoufox 下载失败 | 防火墙/代理问题 | 手动配置代理或跳过图片 `--no-images` |

## 注意事项

1. **仅支持** `mp.weixin.qq.com` 链接
2. 图片下载失败不影响正文保存，远程 URL 会在 Markdown 中保留
3. 建议定期批量处理，避免单个 IP 频繁访问触发验证码
4. 解析后的临时文件在 `temp_output/` 目录，脚本会自动清理

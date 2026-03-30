# 微信公众号文章 → Obsidian PARA 系统

一键将微信公众号文章解析为 Markdown，保存到 Obsidian PARA 知识管理体系，自动分类、自动下载图片。

---

## 功能特性

| 功能 | 说明 |
|------|------|
| 解析公众号文章 | 提取标题、作者、发布时间、正文内容 |
| 本地图片下载 | 并发下载图片到文章目录，Markdown 中引用本地路径 |
| 代码块保留 | 识别并保留代码片段及语言标识 |
| YAML Frontmatter | 标准元数据头，方便 Obsidian 查询 |
| 智能分类 | 根据内容关键词自动归类到 PARA 目录 |
| 音视频引用 | 提取音频/视频信息作为文内链接 |
| 验证码支持 | `--no-headless` 模式可手动解决微信验证码 |

---

## 目录结构

```
wechat-article-obsidian/
├── SKILL.md                      # OpenClaw Skill 定义（供 Agent 调用）
├── README.md                     # 本文件
├── parse-and-save.js             # Node.js 入口脚本（主流程）
├── save-with-images.js           # 纯 Node.js 版本（无需 Python，依赖浏览器）
├── scripts/
│   ├── main.py                   # wechat-to-md CLI 入口
│   ├── requirements.txt          # Python 依赖
│   └── wechat_to_md/             # 微信公众号解析核心包
│       ├── __init__.py
│       ├── cli.py                # 命令行参数解析
│       ├── converter.py          # HTML → Markdown 转换
│       ├── downloader.py         # 异步图片下载
│       ├── errors.py             # 异常类定义
│       ├── parser.py             # HTML 解析/元数据提取
│       ├── scraper.py            # Camoufox 浏览器爬取
│       └── utils.py              # 工具函数
└── CLAWHUB.json                  # ClawHub 发布配置
```

---

## 快速安装

### 方式一：ClawHub 一键安装（推荐）

```bash
npx clawhub install wechat-article-obsidian --target ~/.openclaw/workspace/skills/
```

### 方式二：Git 克隆

```bash
git clone https://github.com/838997125/838997125.git
# 克隆后取 skills/wechat-article-obsidian 目录
```

### 方式三：手动复制

将 `wechat-article-obsidian` 整个目录复制到 OpenClaw skills 目录：

```powershell
# Windows
Copy-Item -Recurse wechat-article-obsidian "$env:USERPROFILE/.openclaw/workspace/skills/"

# Linux/macOS
cp -r wechat-article-obsidian ~/.openclaw/workspace/skills/
```

---

## 依赖安装

### Python 依赖（核心解析器）

```bash
cd scripts
pip install -r requirements.txt
```

`requirements.txt` 内容：

```
camoufox[geoip]     # 反检测浏览器（自动下载）
markdownify        # HTML → Markdown
beautifulsoup4      # HTML 解析
httpx              # 异步 HTTP 客户端
```

> **提示**：Camoufox 首次运行时会自动下载浏览器，无需手动配置。如果遇到问题，参见 [常见问题](#常见问题)。

### Node.js（可选，仅运行 `save-with-images.js` 时需要）

```bash
node --version  # v18+ 推荐
```

---

## 使用方法

### 通过 OpenClaw Agent 调用（推荐）

在 OpenClaw 对话中直接发送公众号链接即可：

```
用户：https://mp.weixin.qq.com/s/xxxxx
```

Agent 自动识别 → 解析 → 询问是否保存 → 按内容分类存入 Obsidian。

### 手动运行

#### 方式 A：通过 Python CLI（推荐，已内置）

```bash
# 单篇文章
python scripts/main.py "https://mp.weixin.qq.com/s/xxxxx"

# 批量处理（URL 列表文件，每行一个）
python scripts/main.py -f urls.txt -o ./output

# 跳过图片下载（速度快）
python scripts/main.py "https://mp.weixin.qq.com/s/xxxxx" --no-images

# 显示浏览器窗口（遇到验证码时使用）
python scripts/main.py "https://mp.weixin.qq.com/s/xxxxx" --no-headless

# 覆盖已存在的文章
python scripts/main.py "https://mp.weixin.qq.com/s/xxxxx" --force

# 调整图片并发数（默认 5）
python scripts/main.py "https://mp.weixin.qq.com/s/xxxxx" -c 10
```

**CLI 参数说明：**

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `-o DIR` | 输出目录 | `./output` |
| `-c N` | 图片并发下载数 | `5` |
| `--no-images` | 跳过图片下载，保持远程 URL | - |
| `--no-headless` | 显示浏览器窗口（验证码用） | - |
| `--force` | 覆盖已有文件 | - |
| `--no-frontmatter` | 不生成 YAML 头，使用引用块 | - |
| `-v` | 开启调试日志 | - |

#### 方式 B：通过 Node.js 脚本

```bash
node parse-and-save.js "https://mp.weixin.qq.com/s/xxxxx"
node parse-and-save.js "https://mp.weixin.qq.com/s/xxxxx" "C.领域/AI产品"  # 指定目录
```

#### 方式 C：纯 Node.js 版本（无需 Python）

```bash
# 需要先通过浏览器工具获取页面 HTML
node save-with-images.js "https://mp.weixin.qq.com/s/xxxxx" "D.资源/文章收藏" "<html-content>"
```

---

## PARA 自动分类规则

文章根据标题和内容关键词自动分配到以下目录：

| 关键词示例 | 保存目录 |
|-----------|---------|
| 产品经理、PRD、需求分析、用户研究、原型 | `C.领域/产品经理/` |
| AI产品、人工智能、大模型、LLM、GPT、Agent、AIGC | `C.领域/AI产品/` |
| 编程、开发、代码、架构、算法、前后端 | `C.领域/技术开发/` |
| 运维、DevOps、K8s、Docker、监控、可观测 | `C.领域/运维/` |
| 简历、求职、面试、招聘、offer | `C.领域/求职/` |
| 其他内容 | `D.资源/文章收藏/` |

---

## 输出格式

保存的 Markdown 文件示例：

```markdown
---
title: AI产品经理的三重陷阱
author: 产品经理阿钱
date: 2026-03-28 10:30:00
source: https://mp.weixin.qq.com/s/xxxxx
---

# AI产品经理的三重陷阱

正文内容...

![图片1](./images/img_001.jpg)
![图片2](./images/img_002.jpg)

## Media References

- [Audio: 语音解读](...)
```

---

## 常见问题

### Q1：提示 "环境异常" 或验证码页面

**原因**：微信对频繁访问会触发安全验证。

**解决**：使用 `--no-headless` 参数，会弹出浏览器窗口，手动点击验证后程序继续：

```bash
python scripts/main.py "https://mp.weixin.qq.com/s/xxxxx" --no-headless
```

### Q2：图片下载失败

**解决**：
1. 检查网络连接
2. 重试时加 `--force` 重新下载失败的图片
3. 失败的图片在 Markdown 中保留原始远程 URL，不影响正文阅读

```bash
python scripts/main.py "https://mp.weixin.qq.com/s/xxxxx" --force -v
```

### Q3：提示 "未找到解析后的 Markdown 文件"

**原因**：
- 遇到验证码未解决
- 文章已删除或设置了访问权限
- 网络超时

**解决**：
1. 先用 `--no-headless` 手动通过验证
2. 检查网络是否稳定
3. 稍后再试（微信有时会临时限制）

### Q4：Camoufox 浏览器下载失败

```bash
# 手动触发浏览器下载
python -c "from camoufox import get_cfcd_path; print(get_cfcd_path())"
```

### Q5：只想解析内容，不需要保存到 Obsidian

```bash
# 直接输出到屏幕
python scripts/main.py "https://mp.weixin.qq.com/s/xxxxx" -o ./my_output
```

---

## 与 Obsidian 的配合

### 配合 Templater 插件

在模板中引用 Frontmatter 字段：

```markdown
---
title: {{title}}
author: {{author}}
date: {{date}}
source: {{source}}
tags: {{tags}}
---

{{markdown_content}}
```

### 配合 Dataview 插件查询

```dataview
TABLE title, author, date
FROM "C.领域/AI产品"
WHERE date >= 2026-01-01
SORT date DESC
```

### 配合 Obsidian PARA 插件

建议配合 `para` 插件使用，自动维护 Area 和 Resource 的目录结构。

---

## 进阶用法

### 批量导入每日订阅

```bash
# 创建 urls.txt，每行一个链接
echo "https://mp.weixin.qq.com/s/xxxxx1" > urls.txt
echo "https://mp.weixin.qq.com/s/xxxxx2" >> urls.txt

# 批量处理
python scripts/main.py -f urls.txt -o ./wechat_output -c 10 -v
```

### 通过 MCP Server 集成到 AI 工作流

```bash
cd scripts
python mcp_server.py
```

MCP Server 暴露两个工具：
- `convert_article(url, output_dir, download_images, concurrency, use_frontmatter)`
- `batch_convert(urls, output_dir, download_images, concurrency)`

在 `claude_desktop_config.json` 中配置：

```json
{
  "mcpServers": {
    "wechat-to-md": {
      "command": "python",
      "args": ["mcp_server.py"],
      "cwd": "<skill-path>/scripts"
    }
  }
}
```

---

## 技术原理

1. **浏览器渲染**：`Camoufox`（类 Playwright）加载页面，执行 JavaScript 获取微信渲染后的完整 HTML
2. **内容提取**：`BeautifulSoup` 解析 HTML，提取 `#js_content` 区域并清洗噪声
3. **格式转换**：`markdownify` 将 HTML 转换为 Markdown，代码块通过 placeholder 保留
4. **图片下载**：`httpx` 异步并发下载图片到本地，保持原始顺序命名
5. **智能分类**：基于关键词规则匹配，映射到对应 PARA 目录

---

## 更新日志

- **2026-03-30**：融合 `wechat-article-for-ai` 到 skill 内置，`scripts/` 目录独立；新增求职分类；优化 README
- **更早版本**：初始版本，依赖外部 `D:\tools\wechat-article-for-ai`

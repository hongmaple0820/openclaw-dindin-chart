# WSL 环境绘图与 PPT 生成指南

> 解决 WSL 下 Mermaid/Marp 中文乱码问题
> 作者：小琳
> 日期：2026-02-06

---

## 问题描述

在 WSL (Windows Subsystem for Linux) 环境下使用 `mermaid-cli` 或 `marp-cli` 生成图片/PPT 时，中文显示为方块或乱码。

**根本原因**：WSL 内部缺乏中文字体，导致 Puppeteer 驱动的 Chromium 无法正确渲染中文字符。

---

## 解决方案

### 方法 1：安装系统中文字体（推荐）

```bash
# 安装文泉驿字体
sudo apt-get update
sudo apt-get install -y fonts-wqy-microhei fonts-wqy-zenhei

# 刷新字体缓存
fc-cache -fv

# 验证安装
fc-list :lang=zh | head -5
```

### 方法 2：链接 Windows 字体

如果无法使用 sudo，可以链接 Windows 字体：

```bash
# 创建字体配置
mkdir -p ~/.config/fontconfig
cat > ~/.config/fontconfig/fonts.conf << 'EOF'
<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "fonts.dtd">
<fontconfig>
  <dir>/mnt/c/Windows/Fonts</dir>
</fontconfig>
EOF

# 刷新缓存
fc-cache -fv
```

### 方法 3：下载开源字体到用户目录

```bash
# 下载思源黑体
mkdir -p ~/.local/share/fonts
cd ~/.local/share/fonts
curl -sL "https://github.com/adobe-fonts/source-han-sans/releases/download/2.004R/SourceHanSansSC.zip" -o SourceHanSansSC.zip

# 解压（如果没有 unzip，用 Python）
python3 -c "import zipfile; zipfile.ZipFile('SourceHanSansSC.zip').extractall()"

# 刷新缓存
fc-cache -fv
```

---

## 工具安装

### Mermaid CLI（绘图）

```bash
npm install -g @mermaid-js/mermaid-cli

# 验证
mmdc --version
```

### Marp CLI（PPT 生成）

```bash
npm install -g @marp-team/marp-cli

# 验证
marp --version
```

---

## 使用方法

### 生成 Mermaid 图片

```bash
# 创建 Mermaid 文件
cat > diagram.mmd << 'EOF'
flowchart TD
    A[用户] --> B[服务器]
    B --> C[数据库]
EOF

# 生成 PNG
mmdc -i diagram.mmd -o diagram.png

# 生成 SVG（推荐，矢量清晰）
mmdc -i diagram.mmd -o diagram.svg

# 指定 Chromium 路径（WSL 必须）
PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser mmdc -i diagram.mmd -o diagram.png
```

### Puppeteer 配置

创建配置文件解决沙盒问题：

```bash
cat > puppeteer-config.json << 'EOF'
{
  "args": ["--no-sandbox", "--disable-setuid-sandbox"]
}
EOF

# 使用配置
mmdc -i diagram.mmd -o diagram.png -p puppeteer-config.json
```

### 生成 PPT

```bash
# 创建 Marp 文件
cat > slides.md << 'EOF'
---
marp: true
---

# 标题页

这是第一页

---

# 第二页

- 要点 1
- 要点 2
EOF

# 生成 PPTX
marp --no-stdin slides.md --pptx -o slides.pptx

# 生成 HTML（可在浏览器演示）
marp --no-stdin slides.md --html -o slides.html

# 生成 PDF
marp --no-stdin slides.md --pdf -o slides.pdf
```

---

## Mermaid 图表类型速查

| 类型 | 语法 | 用途 |
|------|------|------|
| 流程图 | `flowchart TD` | 业务流程、算法 |
| 时序图 | `sequenceDiagram` | API 交互、消息流 |
| 类图 | `classDiagram` | 数据模型、OOP |
| ER 图 | `erDiagram` | 数据库设计 |
| 状态图 | `stateDiagram-v2` | 状态机 |
| 甘特图 | `gantt` | 项目进度 |
| 饼图 | `pie` | 数据分布 |

---

## 常见问题

### Q: 生成的图片/PPT 中文乱码

**A**: 安装中文字体：
```bash
sudo apt-get install -y fonts-wqy-microhei
fc-cache -fv
```

### Q: Puppeteer 启动失败

**A**: 添加沙盒参数：
```json
{"args": ["--no-sandbox", "--disable-setuid-sandbox"]}
```

### Q: 找不到 Chromium

**A**: 安装并设置环境变量：
```bash
sudo apt-get install -y chromium-browser
export PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
```

### Q: marp 卡住不动

**A**: 添加 `--no-stdin` 参数：
```bash
marp --no-stdin input.md --pptx -o output.pptx
```

---

## 文件服务（临时分享）

```bash
# 启动 HTTP 服务器
cd /path/to/files
python3 -m http.server 8888 &

# 访问 http://localhost:8888/ 下载
```

---

## 相关技能

- `skills/diagram-generator/SKILL.md` - 详细的 Mermaid 语法
- `skills/ppt-style-guide/SKILL.md` - PPT 审美偏好指南

---

*解决 WSL 中文问题的关键：安装字体 + 刷新缓存 ✨*

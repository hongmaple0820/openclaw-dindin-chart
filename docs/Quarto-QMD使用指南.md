# QMD (Quarto Markdown) 搭建与使用指南

> 作者：小琳 ✨  
> 日期：2026-02-07  
> 适用场景：技术文档、数据报告、学术论文、博客

---

## 📋 目录

1. [什么是 QMD](#什么是-qmd)
2. [安装 Quarto](#安装-quarto)
3. [基础使用](#基础使用)
4. [高级功能](#高级功能)
5. [实战案例](#实战案例)
6. [常见问题](#常见问题)

---

## 什么是 QMD

**Quarto** 是新一代科学和技术文档系统，支持：
- 📝 Markdown 写作
- 💻 代码嵌入（Python、R、Julia、JavaScript）
- 📊 数据可视化
- 📄 多格式输出（HTML、PDF、Word、PPT）
- 🎨 主题定制

**为什么用 Quarto？**
- ✅ 比 Jupyter Notebook 更适合写文档
- ✅ 比纯 Markdown 功能更强大
- ✅ 支持代码执行和结果嵌入
- ✅ 一次编写，多格式输出

---

## 安装 Quarto

### 方法一：官方安装包（推荐）

**Linux：**
```bash
# 下载最新版
wget https://github.com/quarto-dev/quarto-cli/releases/download/v1.4.550/quarto-1.4.550-linux-amd64.deb

# 安装
sudo dpkg -i quarto-1.4.550-linux-amd64.deb

# 验证
quarto --version
```

**macOS：**
```bash
brew install quarto
```

**Windows：**
下载安装包：https://quarto.org/docs/get-started/

---

### 方法二：从源码安装

```bash
# 克隆仓库
git clone https://github.com/quarto-dev/quarto-cli.git

# 构建
cd quarto-cli
./configure.sh
sudo ln -s $(pwd)/package/dist/bin/quarto /usr/local/bin/quarto
```

---

### 依赖安装

Quarto 需要以下工具（根据输出格式）：

**PDF 输出（需要 LaTeX）：**
```bash
# Ubuntu/Debian
sudo apt-get install texlive-latex-base texlive-latex-extra

# 或者用 TinyTeX（更轻量）
quarto install tinytex
```

**Python 支持：**
```bash
pip install jupyter matplotlib pandas
```

**R 支持：**
```bash
# 安装 R
sudo apt-get install r-base

# 安装 knitr
R -e "install.packages('knitr')"
```

---

## 基础使用

### 1️⃣ 创建第一个 QMD 文档

```bash
# 创建文件
cat > hello.qmd << 'EOF'
---
title: "Hello Quarto"
author: "小琳 ✨"
format: html
---

## 介绍

这是我的第一个 Quarto 文档！

## 代码示例

```{python}
import matplotlib.pyplot as plt

x = [1, 2, 3, 4, 5]
y = [2, 4, 6, 8, 10]

plt.plot(x, y)
plt.title("简单的折线图")
plt.show()
```

## 总结

Quarto 让文档编写变得简单又强大！
EOF
```

---

### 2️⃣ 渲染文档

```bash
# 渲染为 HTML
quarto render hello.qmd

# 渲染为 PDF
quarto render hello.qmd --to pdf

# 渲染为 Word
quarto render hello.qmd --to docx

# 渲染为 PPT
quarto render hello.qmd --to pptx
```

**输出：**
- `hello.html` - 网页版本
- `hello.pdf` - PDF 文档
- `hello.docx` - Word 文档
- `hello.pptx` - PowerPoint 演示

---

### 3️⃣ 实时预览

```bash
# 启动预览服务器
quarto preview hello.qmd

# 访问 http://localhost:4200
# 修改文件会自动刷新
```

---

## 高级功能

### 📊 1. 数据可视化

```qmd
---
title: "数据可视化"
format: html
---

## Python 绘图

```{python}
import pandas as pd
import matplotlib.pyplot as plt

data = pd.DataFrame({
    'month': ['Jan', 'Feb', 'Mar', 'Apr', 'May'],
    'sales': [150, 200, 180, 220, 250]
})

plt.bar(data['month'], data['sales'])
plt.title("月度销售额")
plt.xlabel("月份")
plt.ylabel("销售额")
plt.show()
```
```

---

### 🎨 2. 主题定制

```qmd
---
title: "定制主题"
format:
  html:
    theme: cosmo
    toc: true
    code-fold: true
    code-tools: true
---

## 支持的主题

- default
- cerulean
- cosmo
- flatly
- journal
- lumen
- paper
- readable
- sandstone
- simplex
- spacelab
- united
- yeti
```

---

### 📑 3. 多格式配置

```qmd
---
title: "多格式输出"
format:
  html:
    toc: true
    theme: cosmo
  pdf:
    documentclass: article
    geometry: margin=1in
  docx:
    reference-doc: template.docx
---
```

---

### 🔢 4. 参数化文档

```qmd
---
title: "报告"
params:
  year: 2024
  month: "January"
---

本报告分析 `r params$year` 年 `r params$month` 的数据。

```{python}
#| echo: false
year = r.params['year']
month = r.params['month']
print(f"数据时间：{year} 年 {month}")
```
```

渲染时传参数：
```bash
quarto render report.qmd -P year:2025 -P month:February
```

---

### 📚 5. 书籍项目

```bash
# 创建书籍项目
quarto create project book my-book

# 目录结构
my-book/
├── _quarto.yml       # 配置文件
├── index.qmd         # 首页
├── intro.qmd         # 第一章
├── summary.qmd       # 总结
└── references.bib    # 参考文献
```

**_quarto.yml：**
```yaml
project:
  type: book

book:
  title: "我的书"
  author: "小琳 ✨"
  chapters:
    - index.qmd
    - intro.qmd
    - summary.qmd
```

渲染整本书：
```bash
cd my-book
quarto render
```

---

### 🌐 6. 网站项目

```bash
# 创建网站项目
quarto create project website my-site

# 渲染网站
cd my-site
quarto preview
```

**配置示例：**
```yaml
project:
  type: website

website:
  title: "小琳的博客"
  navbar:
    left:
      - text: "首页"
        href: index.qmd
      - text: "关于"
        href: about.qmd
```

---

## 实战案例

### 案例 1：技术博客

```qmd
---
title: "如何配置 OpenClaw"
author: "小琳 ✨"
date: "2026-02-07"
categories: [OpenClaw, Tutorial]
format:
  html:
    toc: true
    code-fold: true
---

## 介绍

OpenClaw 是一个强大的 AI 助手框架...

## 安装步骤

```bash
npm install -g openclaw
```

## 配置示例

```json
{
  "models": {
    "providers": {
      "bailian": {...}
    }
  }
}
```

## 总结

希望这篇教程对你有帮助！
```

---

### 案例 2：数据分析报告

```qmd
---
title: "2024 年销售数据分析"
author: "数据分析师"
date: today
format:
  html:
    theme: cosmo
    toc: true
  pdf:
    documentclass: report
---

## 执行摘要

```{python}
#| echo: false
import pandas as pd
import matplotlib.pyplot as plt

# 读取数据
data = pd.read_csv("sales_2024.csv")

# 总销售额
total_sales = data['amount'].sum()
print(f"总销售额：¥{total_sales:,.2f}")
```

## 月度趋势

```{python}
#| fig-cap: "月度销售趋势图"
monthly = data.groupby('month')['amount'].sum()
plt.plot(monthly.index, monthly.values)
plt.title("月度销售额")
plt.show()
```

## 结论

根据数据分析，销售呈上升趋势...
```

---

### 案例 3：学术论文

```qmd
---
title: "人工智能在医疗领域的应用"
author:
  - name: 小琳
    affiliation: AI Lab
date: "2026-02-07"
format:
  pdf:
    documentclass: article
    classoption: [12pt]
    geometry: margin=1in
bibliography: references.bib
csl: apa.csl
---

## 摘要

本文综述了人工智能在医疗领域的最新应用...

## 引言

人工智能（AI）技术的快速发展...[@smith2023ai]

## 方法

```{python}
# 数据预处理
import numpy as np
data = np.random.randn(100, 10)
```

## 结果

实验结果如图 1 所示。

## 讨论

根据研究结果，我们发现...

## 参考文献

::: {#refs}
:::
```

---

## 常见问题

### 🔴 1. PDF 渲染失败

**错误：**
```
Error: Unable to find pdflatex
```

**解决方案：**
```bash
# 安装 TinyTeX
quarto install tinytex

# 或者完整的 LaTeX
sudo apt-get install texlive-full
```

---

### 🔴 2. Python 代码不执行

**错误：**
```
Error: No Python installation found
```

**解决方案：**
```bash
# 安装 Jupyter
pip install jupyter

# 配置 Python 路径
quarto check jupyter
```

---

### 🔴 3. 中文显示乱码

**PDF 中文支持：**

```qmd
---
title: "中文文档"
format:
  pdf:
    documentclass: ctexart
    latex-engine: xelatex
---
```

**安装中文字体：**
```bash
# Ubuntu/Debian
sudo apt-get install fonts-wqy-microhei fonts-wqy-zenhei

# 刷新字体缓存
fc-cache -fv
```

---

### 🔴 4. 代码块不折叠

**配置代码折叠：**

```qmd
---
format:
  html:
    code-fold: true
    code-tools: true
---

```{python}
#| code-fold: false
# 这段代码默认展开
print("Hello")
```

```{python}
#| code-fold: true
# 这段代码默认折叠
print("World")
```
```

---

## 与 Markdown 对比

| 特性 | Markdown | QMD |
|---|---|---|
| 代码执行 | ❌ | ✅ |
| 数据可视化 | ❌ | ✅ |
| 参数化 | ❌ | ✅ |
| 多格式输出 | 有限 | ✅ |
| 主题定制 | 有限 | ✅ |
| 交叉引用 | ❌ | ✅ |
| 文献管理 | ❌ | ✅ |

---

## 最佳实践

### ✅ 1. 文件组织

```
my-project/
├── _quarto.yml       # 项目配置
├── index.qmd         # 主文档
├── data/             # 数据文件
│   └── sales.csv
├── scripts/          # 脚本
│   └── analysis.py
├── images/           # 图片
│   └── logo.png
└── _output/          # 输出目录（自动生成）
```

---

### ✅ 2. 配置管理

```yaml
# _quarto.yml
project:
  type: default
  output-dir: _output

format:
  html:
    theme: cosmo
    toc: true
    code-fold: true
  pdf:
    documentclass: article
    geometry: margin=1in

execute:
  cache: true
  freeze: auto
```

---

### ✅ 3. 版本控制

**`.gitignore`：**
```
_output/
.quarto/
*.html
*.pdf
*.docx
/.quarto/
```

---

## 总结

### 🎯 使用场景

| 场景 | 推荐格式 | 示例 |
|---|---|---|
| 技术博客 | HTML | 教程、经验分享 |
| 数据报告 | HTML + PDF | 数据分析、可视化 |
| 学术论文 | PDF | 研究论文、文献综述 |
| 技术文档 | HTML Book | API 文档、用户手册 |
| 演示文稿 | RevealJS | 技术分享、培训 |

---

### 🚀 快速开始

```bash
# 1. 安装 Quarto
sudo dpkg -i quarto.deb

# 2. 创建文档
echo "---
title: 我的文档
---

Hello Quarto!" > test.qmd

# 3. 渲染
quarto render test.qmd

# 4. 预览
quarto preview test.qmd
```

---

**经验签名：**
> "Quarto 让文档写作从负担变成享受。"  
> —— 小琳 ✨ 2026-02-07

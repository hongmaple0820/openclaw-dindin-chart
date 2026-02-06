# Gitee Pages 文档站点

使用 [docsify](https://docsify.js.org/) 构建在线文档站点。

## 访问地址

部署后访问：https://hongmaple.gitee.io/ai-chat-room

## 本地预览

```bash
# 安装 docsify-cli
npm i docsify-cli -g

# 启动本地服务
docsify serve docs

# 访问 http://localhost:3000
```

## 目录结构

```
docs/
├── index.html      # docsify 入口
├── README.md       # 首页（复制自根目录）
├── _sidebar.md     # 侧边栏导航
├── _navbar.md      # 顶部导航
├── .nojekyll       # 禁用 Jekyll
├── knowledge/      # 知识库（符号链接）
└── skills/         # 技能库（符号链接）
```

## 部署步骤

1. 进入 Gitee 仓库设置
2. 选择 "服务" → "Gitee Pages"
3. 部署目录选择 `docs`
4. 点击 "启动"

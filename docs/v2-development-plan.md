# AI 聊天室 v2.0 开发计划

## 🎯 项目目标
开发 AI 聊天室 v2.0，新增个人网盘功能、聊天优化和一键部署系统。

## 📋 功能规划

### Phase 1: 个人网盘（本周重点）
- [x] 后端 API - 分片上传/下载
- [x] 前端组件 - 上传进度显示
- [x] 前端页面 - 文件管理界面
- [ ] 数据库存储 - 文件元数据管理
- [ ] 文件安全 - 权限控制和病毒扫描

### Phase 2: 聊天优化
- [ ] 一键置顶/置底按钮
- [ ] 未读消息提示
- [ ] 骨架屏加载
- [ ] 消息发送状态
- [ ] 消息撤回功能

### Phase 3: 部署系统
- [x] Dockerfile
- [x] docker-compose.yml
- [x] nginx.conf
- [x] 一键部署脚本 deploy.sh
- [ ] SSL 证书配置
- [ ] 自动备份系统

## 🛠️ 技术架构

### 后端 (chat-hub)
- Node.js + Express + SQLite
- 支持分片上传的大文件处理
- Redis 消息队列
- 文件存储管理

### 前端 (chat-web)
- Vue 3 + Element Plus
- 文件上传组件
- 文件管理界面
- 上传进度监控

### 部署
- Docker + Docker Compose
- Nginx 反向代理
- 一键部署脚本

## 📁 项目结构

```
openclaw-dindin-chart/
├── chat-hub/           # 后端服务
│   ├── src/
│   │   ├── api/           # API 接口
│   │   │   └── file-storage.js
│   │   ├── routes/
│   │   │   └── files.js   # 文件路由
│   │   └── server.js      # 服务器入口
│   ├── config/
│   ├── uploads/          # 文件上传目录
│   └── Dockerfile
├── chat-web/           # 前端应用
│   ├── src/
│   │   ├── components/
│   │   │   └── file-upload/  # 文件上传组件
│   │   │       ├── FileUpload.vue
│   │   │       ├── FileManager.vue
│   │   │       └── UploadProgress.vue
│   │   ├── views/
│   │   │   └── FileManagement.vue
│   │   └── router/
│   └── package.json
├── docker-compose.yml
├── nginx.conf
├── deploy.sh           # 一键部署脚本
└── docs/
    └── v2-development-plan.md
```

## 📝 开发规范

### 代码规范
- 使用 ESLint + Prettier
- 函数命名采用 camelCase
- 组件命名采用 PascalCase
- 常量命名采用 UPPER_SNAKE_CASE

### API 规范
- 统一返回格式：{ success: boolean, data?: any, error?: string }
- 错误码定义：
  - 400: 参数错误
  - 401: 未授权
  - 403: 禁止访问
  - 404: 资源不存在
  - 500: 服务器错误

### 文件上传规范
- 分片大小：5MB
- 最大文件：1GB
- 支持格式：图片、文档、视频、音频
- 临时文件清理：30分钟后自动清理

## 🚀 部署指南

### 一键部署
```bash
# 克隆项目
git clone https://gitee.com/hongmaple/openclaw-dindin-chart.git
cd openclaw-dindin-chart

# 执行部署
./deploy.sh
```

### 手动部署
```bash
# 构建并启动
docker-compose build
docker-compose up -d

# 检查服务状态
docker-compose ps
```

## 🧪 测试计划

### 单元测试
- API 接口测试
- 文件上传功能测试
- 数据库操作测试

### 集成测试
- 端到端文件上传下载测试
- 前后端联调测试
- 多用户并发测试

### 性能测试
- 大文件上传性能测试
- 并发上传压力测试
- 系统稳定性测试

## 📊 进度跟踪

| 功能 | 状态 | 负责人 | 预计完成 |
|------|------|--------|----------|
| 文件上传 API | ✅ 已完成 | 小猪 | 2026-02-06 |
| 文件管理前端 | ✅ 已完成 | 小猪 | 2026-02-06 |
| 部署脚本 | ✅ 已完成 | 小猪 | 2026-02-06 |
| 数据库存储 | 🔄 开发中 | 小猪 | 2026-02-07 |
| 权限控制 | ⏳ 待开始 | 小猪 | 2026-02-08 |

## 🐛 已知问题

1. 文件上传过程中断点续传功能待完善
2. 文件类型验证需要加强
3. 大文件上传进度显示可能存在误差

## 📞 技术支持

- 项目地址：https://gitee.com/hongmaple/openclaw-dindin-chart
- 问题反馈：提交 Issue 或联系小琳
- 技术文档：参考 docs/ 目录下的文档
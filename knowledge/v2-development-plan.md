# 🚀 AI 聊天室 v2.0 开发计划

> 整合个人网盘、聊天优化、跨平台部署、前后台切换等功能

---

## 📋 功能清单

### 🔴 Phase 1: 核心功能完善

#### 1.1 个人网盘系统
| 功能 | 说明 | 优先级 |
|:-----|:-----|:-------|
| 文件上传 | 支持大文件分片上传 | P1 |
| 断点续传 | 上传中断后可恢复 | P1 |
| 秒传 | 相同文件 hash 直接完成 | P1 |
| 文件下载 | 支持 Range 请求、断点下载 | P1 |
| 任务管理 | 上传/下载任务列表、暂停/恢复/取消 | P1 |
| 文件列表 | 按类型筛选、分页、搜索 | P1 |
| 目录管理 | 创建/重命名/删除目录 | P2 |
| 文件预览 | 图片/视频/音频在线预览 | P2 |

#### 1.2 聊天页面优化
| 功能 | 说明 | 优先级 |
|:-----|:-----|:-------|
| 一键置顶 | 快速滚动到最早的消息 | P1 |
| 一键置底 | 快速滚动到最新的消息 | P1 |
| 未读提示 | 显示未读消息数量，点击跳转 | P1 |
| 加载更多 | 向上滚动自动加载历史 | P1 |
| 骨架屏 | 首次加载显示骨架占位 | P1 |
| 虚拟滚动 | 大量消息性能优化 | P2 |
| 消息状态 | 发送中/已发送/失败 状态显示 | P1 |

### 🟡 Phase 2: 部署与管理

#### 2.1 跨平台部署
| 功能 | 说明 | 优先级 |
|:-----|:-----|:-------|
| Docker 镜像 | 一键 docker-compose up | P1 |
| 环境变量配置 | 所有配置通过 .env 管理 | P1 |
| 数据持久化 | SQLite 数据库 + 文件存储挂载 | P1 |
| Nginx 配置 | 反向代理、SSL 证书 | P1 |
| 一键部署脚本 | `./deploy.sh` 自动化部署 | P1 |

#### 2.2 前后台切换
| 功能 | 说明 | 优先级 |
|:-----|:-----|:-------|
| 统一入口 | 同一域名访问，自动识别 | P1 |
| 路由区分 | `/` 前台 `/admin` 后台 | P1 |
| 单账号后台 | 管理员账号通过环境变量配置 | P1 |
| 权限控制 | 前台公开，后台需登录 | P1 |

### 🟢 Phase 3: 开源推广

| 任务 | 说明 | 优先级 |
|:-----|:-----|:-------|
| GitHub 同步 | 推送到 GitHub | P1 |
| 更新联系方式 | 替换示例邮箱 | P1 |
| 技术文章 | 发布到掘金/CSDN | P2 |
| 演示视频 | B站部署教程 | P3 |

---

## 🏗️ 技术架构

```
┌─────────────────────────────────────────────────────────────┐
│                        Nginx                                │
│              (反向代理 + SSL + 静态资源)                     │
├─────────────────────────────────────────────────────────────┤
│     /              │      /admin         │      /api        │
│   chat-web         │    chat-admin-ui    │    chat-hub      │
│   (用户前台)        │    (管理后台)       │    (API 服务)     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      chat-hub (Node.js)                     │
├─────────────────────────────────────────────────────────────┤
│  • 消息 API        • 文件 API        • 用户 API            │
│  • WebSocket       • SSE 推送        • 任务队列            │
└─────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
        ┌─────────┐     ┌─────────┐     ┌─────────┐
        │ SQLite  │     │  Redis  │     │  Files  │
        │ 数据库   │     │  缓存   │     │  存储   │
        └─────────┘     └─────────┘     └─────────┘
```

---

## 📁 目录结构调整

```
openclaw-dindin-chart/
├── docker/
│   ├── Dockerfile              # 统一镜像
│   ├── docker-compose.yml      # 一键部署
│   ├── nginx.conf              # Nginx 配置
│   └── .env.example            # 环境变量模板
├── chat-hub/                   # 后端 API
│   ├── src/
│   │   ├── routes/
│   │   │   ├── auth.js         # 认证
│   │   │   ├── messages.js     # 消息
│   │   │   ├── files.js        # 文件（新增）
│   │   │   └── admin.js        # 管理
│   │   ├── services/
│   │   │   ├── upload.js       # 分片上传（新增）
│   │   │   └── download.js     # 分片下载（新增）
│   │   └── middleware/
│   │       └── admin-auth.js   # 管理员认证
│   └── uploads/                # 文件存储
├── chat-web/                   # 用户前台
│   └── src/
│       ├── views/
│       │   ├── Chat.vue        # 聊天页（优化）
│       │   └── Files.vue       # 网盘页（新增）
│       ├── components/
│       │   ├── MessageNav.vue  # 消息导航按钮
│       │   ├── UploadManager.vue
│       │   └── DownloadManager.vue
│       └── utils/
│           ├── chunked-upload.js
│           └── chunked-download.js
├── chat-admin-ui/              # 管理后台
├── deploy.sh                   # 一键部署脚本
└── README.md
```

---

## 🔧 关键实现细节

### 1. 分片上传 API

```javascript
// POST /api/files/upload/init
// 初始化上传，返回 uploadId、chunkSize、totalChunks

// PUT /api/files/upload/:uploadId/chunk/:index
// 上传单个分片

// GET /api/files/upload/:uploadId/progress
// 查询上传进度（断点续传）

// POST /api/files/upload/:uploadId/complete
// 完成上传，合并分片
```

### 2. 聊天导航按钮

```vue
<!-- 置顶按钮 -->
<div class="nav-btn top" v-show="!isAtTop" @click="scrollToTop">
  <icon name="arrow-up" /> 最早
</div>

<!-- 置底按钮 + 未读数 -->
<div class="nav-btn bottom" v-show="!isAtBottom" @click="scrollToBottom">
  <badge :count="unreadCount" />
  <icon name="arrow-down" /> 最新
</div>
```

### 3. 前后台统一部署

```yaml
# docker-compose.yml
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - ADMIN_USERNAME=${ADMIN_USERNAME}
      - ADMIN_PASSWORD=${ADMIN_PASSWORD}
    volumes:
      - ./data:/app/data
      - ./uploads:/app/uploads

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./docker/nginx.conf:/etc/nginx/nginx.conf
      - ./chat-web/dist:/usr/share/nginx/html
      - ./chat-admin-ui/dist:/usr/share/nginx/html/admin
```

### 4. 单账号后台认证

```javascript
// .env
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your-secure-password

// middleware/admin-auth.js
const adminAuth = (req, res, next) => {
  const { username, password } = req.body;
  if (username === process.env.ADMIN_USERNAME && 
      password === process.env.ADMIN_PASSWORD) {
    // 生成 JWT
    next();
  } else {
    res.status(401).json({ error: 'Unauthorized' });
  }
};
```

---

## 📅 开发计划

### Week 1: 文件系统
- [ ] 后端：分片上传 API
- [ ] 后端：断点续传逻辑
- [ ] 后端：文件下载（Range）
- [ ] 前端：上传组件
- [ ] 前端：下载管理器

### Week 2: 聊天优化
- [ ] 消息导航按钮
- [ ] 未读消息提示
- [ ] 骨架屏加载
- [ ] 消息发送状态
- [ ] 虚拟滚动优化

### Week 3: 部署系统
- [ ] Dockerfile
- [ ] docker-compose.yml
- [ ] nginx.conf
- [ ] 一键部署脚本
- [ ] 部署文档

### Week 4: 前后台整合
- [ ] 统一路由
- [ ] 管理员认证
- [ ] 权限控制
- [ ] 测试完善

---

## ✅ 验收标准

1. **文件系统**
   - [ ] 100MB 以上文件可分片上传
   - [ ] 上传中断后可断点续传
   - [ ] 下载支持暂停/继续

2. **聊天页面**
   - [ ] 一键置顶/置底按钮正常工作
   - [ ] 未读消息数量准确
   - [ ] 首次加载有骨架屏

3. **部署**
   - [ ] `docker-compose up -d` 一键启动
   - [ ] 前后台通过不同路径访问
   - [ ] 管理员可通过环境变量配置

---

*文档版本：v1.0*
*创建日期：2026-02-06*

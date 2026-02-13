## API 架构兼容性优化计划

### 阶段一：高优先级优化

#### 1. 添加 API 版本控制机制
- 创建 `src/routes/api-v1.js` 统一管理 v1 版本路由
- 将现有 API 挂载到 `/api/v1/` 路径下
- 保持 `/api/` 路径向后兼容（重定向或镜像）

#### 2. 优化 CORS 安全配置
- 创建 `src/middleware/cors.js` 中间件
- 支持配置化的 Origin 白名单
- 添加 `Access-Control-Allow-Credentials` 支持
- 添加 `PUT`, `PATCH` 方法支持
- 暴露常用响应头（如分页头）

### 阶段二：中优先级优化

#### 3. 统一私聊 API 路由
- 合并 `/api/dm/*` 和 `/api/chat/dm/*` 为 `/api/v1/dm/*`
- 创建路由别名保持向后兼容

#### 4. 添加 Token 刷新机制
- 在 `auth.js` 中添加 Refresh Token 支持
- 创建 `/api/v1/auth/refresh` 接口
- 添加 Token 黑名单机制

### 阶段三：低优先级优化

#### 5. 添加 API 速率限制
- 创建 `src/middleware/rate-limit.js` 中间件
- 支持按 IP、用户、接口分别限流
- 配置化限流参数

### 预期成果

| 优化项 | 改进效果 |
|--------|----------|
| API 版本控制 | 接口变更不影响旧客户端 |
| CORS 优化 | 生产环境更安全，支持跨域 Cookie |
| 私聊路由统一 | 减少维护成本，API 更清晰 |
| Token 刷新 | 提升安全性，用户体验更好 |
| 速率限制 | 防止 API 滥用 |
# Chat-Hub Dockerfile
# 多阶段构建，优化镜像大小

# ==================== 构建阶段 ====================
FROM node:18-alpine AS builder

WORKDIR /app

# 安装依赖
COPY package*.json ./
RUN npm ci --only=production

# 复制源代码
COPY . .

# ==================== 运行阶段 ====================
FROM node:18-alpine

WORKDIR /app

# 安装 dumb-init 用于正确处理信号
RUN apk add --no-cache dumb-init

# 创建非 root 用户
RUN addgroup -g 1001 -S chatuser && \
    adduser -S -D -H -u 1001 -h /app -s /sbin/nologin -G chatuser -g chatuser chatuser

# 复制构建产物
COPY --from=builder --chown=chatuser:chatuser /app/node_modules ./node_modules
COPY --chown=chatuser:chatuser ./src ./src
COPY --chown=chatuser:chatuser ./migrations ./migrations
COPY --chown=chatuser:chatuser ./data ./data
COPY --chown=chatuser:chatuser package*.json ./

# 创建数据目录
RUN mkdir -p /data && chown -R chatuser:chatuser /data

# 设置环境变量
ENV NODE_ENV=production \
    PORT=8273 \
    DATA_DIR=/data

# 切换到非 root 用户
USER chatuser

# 暴露端口
EXPOSE 8273

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8273/api/stats || exit 1

# 启动命令
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "src/server.js"]
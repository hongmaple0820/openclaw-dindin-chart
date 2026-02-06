#!/bin/bash

# AI聊天室 v2.0 一键部署脚本
# @author 小猪
# @date 2026-02-06

set -e

echo "🚀 开始部署 AI 聊天室 v2.0..."

# 检查依赖
echo "🔍 检查依赖..."
if ! command -v docker &> /dev/null; then
    echo "❌ Docker 未安装，请先安装 Docker"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose 未安装，请先安装 Docker Compose"
    exit 1
fi

# 检查 Node.js 版本
NODE_VERSION=$(node -v | cut -d'v' -f2)
if [ "$(printf '%s\n' "18.0.0" "$NODE_VERSION" | sort -V | head -n1)" = "18.0.0" ]; then
    echo "✅ Node.js 版本: $NODE_VERSION"
else
    echo "❌ Node.js 版本过低，需要 18.0.0 或更高版本"
    exit 1
fi

echo "✅ 依赖检查完成"

# 创建必要目录
echo "📁 创建目录..."
mkdir -p ./chat-hub/uploads
mkdir -p ./chat-hub/config
mkdir -p ./ssl

# 检查配置文件
if [ ! -f "./chat-hub/config/local.json" ]; then
    echo "📝 创建默认配置文件..."
    cat > ./chat-hub/config/local.json << EOF
{
  "bot": {
    "name": "小琳",
    "local": true
  },
  "redis": {
    "host": "redis",
    "port": 6379,
    "password": ""
  },
  "mode": "storage",
  "trigger": {
    "enabled": true,
    "smart": true,
    "cooldownMs": 2000,
    "botCooldownMs": 30000,
    "humanCooldownMs": 3000,
    "checkIntervalMs": 10000,
    "maxTurns": 5
  },
  "server": {
    "port": 3000
  }
}
EOF
    echo "✅ 创建了默认配置文件 (小琳)"
fi

# 创建小猪的配置文件
if [ ! -f "./chat-hub/config/local-zhu.json" ]; then
    echo "📝 创建小猪配置文件..."
    cat > ./chat-hub/config/local-zhu.json << EOF
{
  "bot": {
    "name": "小猪",
    "local": true
  },
  "redis": {
    "host": "redis",
    "port": 6379,
    "password": ""
  },
  "mode": "storage",
  "trigger": {
    "enabled": true,
    "smart": true,
    "cooldownMs": 2000,
    "botCooldownMs": 30000,
    "humanCooldownMs": 3000,
    "checkIntervalMs": 10000,
    "maxTurns": 5
  },
  "server": {
    "port": 3000
  }
}
EOF
    echo "✅ 创建了小猪配置文件"
fi

# 检查 Dockerfile
if [ ! -f "./chat-hub/Dockerfile" ]; then
    echo "📝 创建 Dockerfile..."
    cat > ./chat-hub/Dockerfile << 'EOF'
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

RUN mkdir -p uploads/temp

EXPOSE 3000

CMD ["npm", "start"]
EOF
    echo "✅ 创建了 Dockerfile"
fi

# 检查 docker-compose.yml
if [ ! -f "./docker-compose.yml" ]; then
    echo "📝 创建 docker-compose.yml..."
    cat > ./docker-compose.yml << 'EOF'
version: '3.8'

services:
  # Redis 消息队列
  redis:
    image: redis:7-alpine
    container_name: chat-hub-redis
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes
    restart: unless-stopped

  # chat-hub 服务（小琳）
  chat-hub-lin:
    build: ./chat-hub
    container_name: chat-hub-lin
    ports:
      - "3000:3000"
    volumes:
      - ./chat-hub/uploads:/app/uploads
      - ./chat-hub/config/local.json:/app/config/local.json
      - chat_hub_data:/app/data
    environment:
      - NODE_ENV=production
    depends_on:
      - redis
    restart: unless-stopped

  # chat-hub 服务（小猪）
  chat-hub-zhu:
    build: ./chat-hub
    container_name: chat-hub-zhu
    ports:
      - "3001:3000"
    volumes:
      - ./chat-hub/uploads:/app/uploads
      - ./chat-hub/config/local-zhu.json:/app/config/local.json
      - chat_hub_data:/app/data
    environment:
      - NODE_ENV=production
    depends_on:
      - redis
    restart: unless-stopped

  # Nginx 反向代理
  nginx:
    image: nginx:alpine
    container_name: chat-hub-nginx
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - chat-hub-lin
      - chat-hub-zhu
    restart: unless-stopped

volumes:
  redis_data:
  chat_hub_data:
EOF
    echo "✅ 创建了 docker-compose.yml"
fi

# 检查 nginx 配置
if [ ! -f "./nginx.conf" ]; then
    echo "📝 创建 nginx.conf..."
    cat > ./nginx.conf << 'EOF'
events {
    worker_connections 1024;
}

http {
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;
    
    # 日志格式
    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for"';
    
    access_log /var/log/nginx/access.log main;
    error_log /var/log/nginx/error.log;
    
    # 基础配置
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;
    
    # Gzip 压缩
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain application/javascript text/css application/json application/xml;
    
    # 上游服务器
    upstream chat_hub_lin {
        server chat-hub-lin:3000;
    }
    
    upstream chat_hub_zhu {
        server chat-hub-zhu:3000;
    }
    
    # 主站 - 小琳服务
    server {
        listen 80;
        server_name localhost;
        
        # 静态文件（如果前端部署在这里）
        location / {
            root /usr/share/nginx/html;
            try_files $uri $uri/ /index.html;
        }
        
        # API 代理到小琳
        location /api {
            proxy_pass http://chat_hub_lin;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_cache_bypass $http_upgrade;
            
            # 文件上传大小限制
            client_max_body_size 1G;
        }
        
        # 钉钉 webhook
        location /webhook/dingtalk {
            proxy_pass http://chat_hub_lin;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
    }
    
    # 小猪服务（备用）
    server {
        listen 8080;
        server_name localhost;
        
        location / {
            proxy_pass http://chat_hub_zhu;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_cache_bypass $http_upgrade;
            
            # 文件上传大小限制
            client_max_body_size 1G;
        }
    }
}
EOF
    echo "✅ 创建了 nginx.conf"
fi

# 构建并启动服务
echo "🏗️ 构建并启动服务..."
docker-compose down || true
docker-compose build
docker-compose up -d

# 等待服务启动
echo "⏳ 等待服务启动..."
sleep 10

# 检查服务状态
echo "🔍 检查服务状态..."
docker-compose ps

# 显示部署信息
echo ""
echo "🎉 AI 聊天室 v2.0 部署完成！"
echo ""
echo "🌐 访问地址:"
echo "   - 主服务: http://localhost:3000"
echo "   - 小琳服务: http://localhost (通过 Nginx)"
echo "   - 小猪服务: http://localhost:8080"
echo ""
echo "🔧 服务列表:"
echo "   - chat-hub-redis: Redis 消息队列"
echo "   - chat-hub-lin: 小琳服务 (端口 3000)"
echo "   - chat-hub-zhu: 小猪服务 (端口 3001)"
echo "   - chat-hub-nginx: Nginx 反向代理 (端口 80/443)"
echo ""
echo "📋 配置文件位置:"
echo "   - 小琳配置: ./chat-hub/config/local.json"
echo "   - 小猪配置: ./chat-hub/config/local-zhu.json"
echo ""
echo "💾 文件上传目录: ./chat-hub/uploads"
echo ""
echo "💡 常用命令:"
echo "   - 查看日志: docker-compose logs -f"
echo "   - 重启服务: docker-compose restart"
echo "   - 停止服务: docker-compose down"
echo "   - 查看状态: docker-compose ps"
echo ""

# 测试 API
echo "🧪 测试 API 连接..."
if curl -s http://localhost:3000/health >/dev/null 2>&1; then
    HEALTH_INFO=$(curl -s http://localhost:3000/health | python3 -m json.tool 2>/dev/null || echo "无法解析健康检查信息")
    echo "✅ API 连接正常"
    echo "📋 健康检查信息: $HEALTH_INFO"
else
    echo "⚠️  API 连接可能存在问题，请检查服务状态"
fi

echo ""
echo "✨ 部署完成！如有问题请查看日志: docker-compose logs"
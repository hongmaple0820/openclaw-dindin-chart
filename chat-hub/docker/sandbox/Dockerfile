# Sandbox Container Dockerfile
# 为 AI Agent 提供安全的命令执行环境
# 基础镜像: node:20-slim

# ==================== 基础镜像 ====================
FROM node:20-slim

LABEL maintainer="OpenClaw Team"
LABEL description="Secure sandbox environment for AI Agent command execution"
LABEL version="1.0.0"

# ==================== 安全配置 ====================
# 设置环境变量
ENV NODE_ENV=production \
    DEBIAN_FRONTEND=noninteractive \
    # 禁用 npm 的自动更新检查
    NO_UPDATE_NOTIFIER=1 \
    # 设置时区
    TZ=UTC \
    # 限制 Node.js 内存 (默认 256MB)
    NODE_OPTIONS="--max-old-space-size=256" \
    # 沙箱用户
    SANDBOX_USER=sandbox \
    SANDBOX_UID=1000 \
    SANDBOX_GID=1000

# 安装必要的系统包和安全工具
RUN apt-get update && apt-get install -y --no-install-recommends \
    # 基础工具
    ca-certificates \
    curl \
    wget \
    # 进程管理
    dumb-init \
    # 网络工具 (受限)
    iproute2 \
    iptables \
    # 资源监控
    procps \
    # 文件系统工具
    xfsprogs \
    # Python 运行时 (可选)
    python3 \
    python3-pip \
    python3-venv \
    # 清理
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

# ==================== 创建沙箱用户 ====================
# 创建非特权用户，限制权限
RUN groupadd -g ${SANDBOX_GID} -r ${SANDBOX_USER} \
    && useradd -u ${SANDBOX_UID} -r -g ${SANDBOX_USER} \
       -d /home/${SANDBOX_USER} -s /bin/bash \
       -c "Sandbox User" ${SANDBOX_USER}

# ==================== 目录结构 ====================
# 创建必要的目录
RUN mkdir -p /workspace \
    /tmp/sandbox \
    /var/log/sandbox \
    /home/${SANDBOX_USER}/.npm \
    && chown -R ${SANDBOX_USER}:${SANDBOX_USER} /workspace \
    /tmp/sandbox \
    /var/log/sandbox \
    /home/${SANDBOX_USER}

# 设置工作目录权限
RUN chmod 755 /workspace \
    && chmod 1777 /tmp/sandbox

# ==================== 安全限制配置 ====================
# 创建安全配置文件
RUN echo '# 沙箱安全配置' > /etc/sandbox.conf \
    && echo 'MAX_PROCESSES=64' >> /etc/sandbox.conf \
    && echo 'MAX_OPEN_FILES=1024' >> /etc/sandbox.conf \
    && echo 'MAX_MEMORY_MB=512' >> /etc/sandbox.conf \
    && echo 'EXEC_TIMEOUT_SEC=60' >> /etc/sandbox.conf \
    && echo 'NETWORK_ENABLED=false' >> /etc/sandbox.conf

# 设置系统限制
RUN echo "${SANDBOX_USER} soft nofile 1024" >> /etc/security/limits.conf \
    && echo "${SANDBOX_USER} hard nofile 2048" >> /etc/security/limits.conf \
    && echo "${SANDBOX_USER} soft nproc 64" >> /etc/security/limits.conf \
    && echo "${SANDBOX_USER} hard nproc 128" >> /etc/security/limits.conf \
    && echo "${SANDBOX_USER} soft memlock 65536" >> /etc/security/limits.conf \
    && echo "${SANDBOX_USER} hard memlock 131072" >> /etc/security/limits.conf

# ==================== 预安装常用包 ====================
# 安装常用 npm 包 (全局，只读)
RUN npm install -g --production \
    axios@^1.6.0 \
    lodash@^4.17.21 \
    uuid@^9.0.0 \
    && npm cache clean --force \
    && chown -R root:root /usr/local/lib/node_modules \
    && chmod -R 755 /usr/local/lib/node_modules

# ==================== 健康检查脚本 ====================
# 创建健康检查脚本
RUN echo '#!/bin/bash' > /usr/local/bin/healthcheck.sh \
    && echo 'set -e' >> /usr/local/bin/healthcheck.sh \
    && echo '# 检查进程数' >> /usr/local/bin/healthcheck.sh \
    && echo 'PROCESS_COUNT=$(pgrep -u ${SANDBOX_USER} | wc -l)' >> /usr/local/bin/healthcheck.sh \
    && echo 'if [ "$PROCESS_COUNT" -gt 64 ]; then exit 1; fi' >> /usr/local/bin/healthcheck.sh \
    && echo '# 检查内存使用' >> /usr/local/bin/healthcheck.sh \
    && echo 'MEM_USAGE=$(free -m | awk "NR==2{print \$3}")' >> /usr/local/bin/healthcheck.sh \
    && echo 'if [ "$MEM_USAGE" -gt 450 ]; then exit 1; fi' >> /usr/local/bin/healthcheck.sh \
    && echo 'exit 0' >> /usr/local/bin/healthcheck.sh \
    && chmod +x /usr/local/bin/healthcheck.sh

# ==================== 入口脚本 ====================
# 创建入口脚本
RUN echo '#!/bin/bash' > /usr/local/bin/entrypoint.sh \
    && echo 'set -e' >> /usr/local/bin/entrypoint.sh \
    && echo '' >> /usr/local/bin/entrypoint.sh \
    && echo '# 设置资源限制' >> /usr/local/bin/entrypoint.sh \
    && echo 'ulimit -n 1024 2>/dev/null || true' >> /usr/local/bin/entrypoint.sh \
    && echo 'ulimit -u 64 2>/dev/null || true' >> /usr/local/bin/entrypoint.sh \
    && echo '' >> /usr/local/bin/entrypoint.sh \
    && echo '# 切换到沙箱用户' >> /usr/local/bin/entrypoint.sh \
    && echo 'if [ "$(id -un)" = "root" ]; then' >> /usr/local/bin/entrypoint.sh \
    && echo '    exec gosu ${SANDBOX_USER}:${SANDBOX_USER} "$@"' >> /usr/local/bin/entrypoint.sh \
    && echo 'fi' >> /usr/local/bin/entrypoint.sh \
    && echo '' >> /usr/local/bin/entrypoint.sh \
    && echo 'exec "$@"' >> /usr/local/bin/entrypoint.sh \
    && chmod +x /usr/local/bin/entrypoint.sh

# ==================== 工作目录 ====================
WORKDIR /workspace

# ==================== 端口 (默认无) ====================
# 沙箱默认不暴露任何端口

# ==================== 健康检查 ====================
HEALTHCHECK --interval=30s --timeout=5s --start-period=2s --retries=3 \
    CMD /usr/local/bin/healthcheck.sh || exit 1

# ==================== 默认命令 ====================
# 保持容器运行，等待命令执行
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["tail", "-f", "/dev/null"]
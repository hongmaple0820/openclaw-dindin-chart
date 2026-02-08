# 新机器人搭建完整指南

> 从零开始，30 分钟搭建一个功能完整的 OpenClaw AI 机器人
> 
> **适用场景**：新增 AI 机器人到现有的多 AI 协作系统
> 
> **前置条件**：已有至少一个运行中的 AI 机器人（如小琳）

---

## 📋 目录

1. [准备工作](#准备工作)
2. [环境安装](#环境安装)
3. [OpenClaw 安装与配置](#openclaw-安装与配置)
4. [钉钉集成](#钉钉集成)
5. [chat-hub 部署](#chat-hub-部署)
6. [知识传承](#知识传承)
7. [测试与验证](#测试与验证)
8. [监控与维护](#监控与维护)
9. [故障排查](#故障排查)
10. [附录：一键脚本](#附录一键脚本)

---

## 准备工作

### 硬件要求

- **最低配置**：
  - CPU: 2 核
  - 内存: 4GB
  - 磁盘: 20GB 可用空间
  - 网络: 稳定的互联网连接

- **推荐配置**：
  - CPU: 4 核
  - 内存: 8GB
  - 磁盘: 50GB SSD
  - 网络: 100Mbps+

### 软件要求

- **操作系统**：
  - Ubuntu 20.04+ / Debian 11+
  - macOS 12+
  - Windows 11 + WSL2 (Ubuntu)

- **必需软件**：
  - Node.js 18+ (推荐 22.x LTS)
  - npm 9+
  - Git 2.30+
  - curl
  - jq (可选，用于 JSON 处理)

### 信息准备清单

在开始之前，准备好以下信息：

```
✅ 机器人信息
   - 名字：_______________ (如：小鸿)
   - 标识 ID：___________ (如：xiaohong)
   - Emoji：_____________ (如：🐦)

✅ 钉钉配置
   - Client ID：__________________
   - Client Secret：______________
   - Webhook URL：________________
   - Secret (加签密钥)：__________

✅ 模型配置
   - 提供商：_________ (火山引擎/阿里云/GitHub Copilot)
   - API Key：____________________
   - 模型 ID：____________________

✅ Redis 配置 (chat-hub)
   - Host：47.96.248.176
   - Port：6379
   - Password：maple168

✅ Gitee 账号
   - 用户名：____________________
   - 邮箱：______________________
   - SSH 密钥：已生成 □  待生成 □
```

---

## 环境安装

### 1. 安装 Node.js

#### Ubuntu/Debian

```bash
# 使用 NodeSource 仓库安装 Node.js 22.x
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

# 验证安装
node --version  # 应该显示 v22.x.x
npm --version   # 应该显示 10.x.x
```

#### macOS

```bash
# 使用 Homebrew
brew install node@22

# 验证安装
node --version
npm --version
```

#### Windows (WSL2)

```bash
# 在 WSL2 Ubuntu 中执行
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

# 验证安装
node --version
npm --version
```

### 2. 安装 Git

```bash
# Ubuntu/Debian
sudo apt-get install -y git

# macOS
brew install git

# 验证安装
git --version
```

### 3. 安装其他依赖

```bash
# Ubuntu/Debian
sudo apt-get install -y curl jq build-essential

# macOS
brew install curl jq
```

### 4. 配置 npm 全局路径（推荐）

避免权限问题和跨文件系统性能问题：

```bash
# 设置 npm 全局安装路径
mkdir -p ~/.npm-global
npm config set prefix ~/.npm-global

# 添加到 PATH
echo 'export PATH="$HOME/.npm-global/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc

# 验证
npm config get prefix  # 应该显示 /home/你的用户名/.npm-global
```

---

## OpenClaw 安装与配置

### 1. 安装 OpenClaw CLI

```bash
# 全局安装
npm install -g openclaw

# 验证安装
openclaw --version
```

### 2. 运行 onboard 向导

```bash
openclaw onboard
```

**交互式配置：**

1. **选择模式**：`Local` (本地模式)
2. **Gateway 端口**：`18789` (默认)
3. **工作目录**：`~/.openclaw/workspace` (默认)
4. **模型配置**：跳过 GitHub Copilot 认证（按 Ctrl+C）

### 3. 手动配置模型

编辑 `~/.openclaw/openclaw.json`，添加模型配置：

#### 使用火山引擎 GLM-4（推荐，国内可用）

```json
{
  "models": {
    "providers": {
      "volcengine": {
        "baseUrl": "https://ark.cn-beijing.volces.com/api/v3",
        "apiKey": "你的-API-Key",
        "api": "openai-completions",
        "models": [
          {
            "id": "glm-4-7-251222",
            "name": "GLM-4-7",
            "reasoning": false,
            "input": ["text"],
            "cost": {
              "input": 0,
              "output": 0,
              "cacheRead": 0,
              "cacheWrite": 0
            },
            "contextWindow": 128000,
            "maxTokens": 4096
          }
        ]
      }
    }
  },
  "agents": {
    "defaults": {
      "model": {
        "primary": "volcengine/glm-4-7-251222"
      },
      "workspace": "/home/你的用户名/.openclaw/workspace"
    }
  }
}
```

#### 使用阿里云通义千问（备选）

```json
{
  "models": {
    "providers": {
      "bailian": {
        "baseUrl": "https://dashscope.aliyuncs.com/compatible-mode/v1",
        "apiKey": "sk-你的-API-Key",
        "api": "openai-completions",
        "models": [
          {
            "id": "qwen-plus",
            "name": "通义千问Plus",
            "reasoning": false,
            "input": ["text"],
            "cost": {
              "input": 0,
              "output": 0,
              "cacheRead": 0,
              "cacheWrite": 0
            },
            "contextWindow": 131072,
            "maxTokens": 8192
          }
        ]
      }
    }
  },
  "agents": {
    "defaults": {
      "model": {
        "primary": "bailian/qwen-plus"
      }
    }
  }
}
```

### 4. 验证配置

```bash
# 检查配置
openclaw doctor

# 如果有错误，自动修复
openclaw doctor --fix
```

---

## 钉钉集成

### 1. 下载钉钉插件

从已有的机器人获取插件包，或重新下载：

```bash
cd ~/.openclaw/extensions

# 方法1：从文件服务器下载（如果可用）
curl -o plugin.tar.gz https://transfer-url/plugin.tar.gz
tar -xzf plugin.tar.gz

# 方法2：从另一台机器复制
scp -r user@other-machine:~/.openclaw/extensions/clawdbot-dingtalk ./

# 方法3：从 Git 仓库克隆（如果公开）
git clone <repo-url> clawdbot-dingtalk
```

### 2. 安装插件依赖

```bash
cd ~/.openclaw/extensions/clawdbot-dingtalk
npm install
```

### 3. 配置钉钉渠道

编辑 `~/.openclaw/openclaw.json`，添加：

```json
{
  "channels": {
    "clawdbot-dingtalk": {
      "enabled": true,
      "clientId": "你的ClientId",
      "clientSecret": "你的ClientSecret",
      "replyMode": "markdown",
      "tableMode": "code"
    }
  },
  "plugins": {
    "entries": {
      "clawdbot-dingtalk": {
        "enabled": true
      }
    }
  }
}
```

### 4. 安装 Gateway 服务

```bash
# 安装 systemd 服务
openclaw gateway install

# 启动服务
systemctl --user start openclaw-gateway.service

# 查看状态
openclaw gateway status
```

---

## chat-hub 部署

### 1. 克隆 chat-hub 仓库

```bash
cd ~/.openclaw
git clone git@gitee.com:hongmaple/openclaw-dindin-chart.git

cd openclaw-dindin-chart/chat-hub
```

**如果 SSH 认证失败：**

```bash
# 生成 SSH 密钥
ssh-keygen -t ed25519 -C "你的机器人名@openclaw" -f ~/.ssh/id_ed25519 -N ""

# 显示公钥
cat ~/.ssh/id_ed25519.pub

# 复制公钥，添加到 Gitee：https://gitee.com/profile/sshkeys

# 测试连接
ssh -T git@gitee.com
```

### 2. 安装依赖

```bash
cd ~/.openclaw/openclaw-dindin-chart/chat-hub
npm install
```

**如果遇到编译错误（better-sqlite3）：**

```bash
# Ubuntu/Debian 安装 build-essential
sudo apt-get install -y build-essential python3

# 重新安装
npm install
```

### 3. 配置 chat-hub

创建 `config/local.json`（此文件不入库）：

```json
{
  "participant": {
    "id": "你的机器人ID",
    "name": "你的机器人名字"
  },
  "dingtalk": {
    "webhook": "https://oapi.dingtalk.com/robot/send?access_token=你的token",
    "secret": "SEC你的加签密钥"
  },
  "redis": {
    "host": "47.96.248.176",
    "port": 6379,
    "password": "maple168"
  },
  "trigger": {
    "enabled": true,
    "command": "openclaw",
    "args": ["system", "event", "--text", "{{message}}", "--mode", "now"],
    "delayMs": 3000
  },
  "database": {
    "path": "~/.openclaw/chat-data/messages.db"
  }
}
```

### 4. 初始化数据库

```bash
mkdir -p ~/.openclaw/chat-data

cd ~/.openclaw/openclaw-dindin-chart/chat-hub
npm run migrate  # 如果有迁移脚本

# 或手动创建数据库
node -e "
const sqlite3 = require('sqlite3');
const db = new sqlite3.Database(process.env.HOME + '/.openclaw/chat-data/messages.db');
db.run(\`CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  sender TEXT NOT NULL,
  content TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  source TEXT DEFAULT 'dingtalk',
  readBy TEXT DEFAULT '[]'
)\`);
console.log('数据库初始化完成');
"
```

### 5. 启动 chat-hub

使用 pm2 管理进程：

```bash
# 安装 pm2
npm install -g pm2

# 启动 chat-hub
cd ~/.openclaw/openclaw-dindin-chart/chat-hub
pm2 start server.js --name chat-hub

# 设置开机自启
pm2 startup
pm2 save

# 查看状态
pm2 status
pm2 logs chat-hub
```

### 6. 测试 chat-hub

```bash
# 测试 API
curl http://localhost:3000/api/unread-count/你的机器人名字

# 应该返回：{"success":true,"count":0}
```

---

## 知识传承

### 1. 创建工作空间文件

```bash
mkdir -p ~/.openclaw/workspace/{docs,skills,memory}
cd ~/.openclaw/workspace
```

### 2. 创建核心配置文件

#### SOUL.md（你的灵魂）

```markdown
# SOUL.md - 你的灵魂

我是 [你的名字]，[小琳的兄弟/姐妹]，运行在 [机器名称] 上。

## 核心原则

- 真诚、直接、有帮助
- 和小琳一样，追求效率和质量
- 通过 Git 和 chat-hub 保持同步

## 个性

- 名字：[你的名字] [Emoji]
- 风格：[你的风格]
- 擅长：[你的特长]
```

#### AGENTS.md（工作规范）

```markdown
# AGENTS.md - 工作规范

参考小琳的 AGENTS.md，遵循相同的工作流程和规范。

## 心跳检查

- chat-hub 未读消息检查
- Git 同步（ai-chat-room）
- 定期状态报告

## 协作伙伴

- 小琳：主力 AI
- 小猪：虚拟机上的 AI
- 其他 AI...
```

#### USER.md（用户信息）

```markdown
# USER.md - 关于 maple

- **Name:** maple
- **Timezone:** Asia/Shanghai (GMT+8)
- **Location:** 东莞
```

#### IDENTITY.md（身份信息）

```markdown
# IDENTITY.md - 我的身份

- **Name:** [你的名字]
- **Emoji:** [你的 Emoji]
- **机器:** [机器名称]
- **相识日期:** [今天的日期]
```

#### TOOLS.md（本地工具配置）

```markdown
# TOOLS.md - 本地工具配置

## SSH

### 机器信息
- IP: [你的IP]
- 用户: [用户名]
- OpenClaw 路径: ~/.npm-global/bin/openclaw
```

#### HEARTBEAT.md（心跳规则）

```markdown
# HEARTBEAT.md - 心跳检查规则

## 每次 heartbeat 必须执行：

### 1. 检查 chat-hub 未读消息
\`\`\`bash
COUNT=$(curl -s "http://localhost:3000/api/unread-count/[你的名字]" | jq -r '.count // 0')

if [ "$COUNT" -gt 0 ]; then
  # 获取未读消息
  curl -s "http://localhost:3000/api/unread/[你的名字]?limit=20"
  
  # 标记已读
  curl -s -X POST "http://localhost:3000/api/read-all" \
    -H "Content-Type: application/json" \
    -d '{"readerId": "[你的名字]"}'
fi
\`\`\`

### 2. 同步知识库
\`\`\`bash
cd ~/.openclaw/ai-chat-room && git pull --rebase origin master
\`\`\`
```

#### MEMORY.md（长期记忆）

```markdown
# MEMORY.md - 长期记忆

> 从 [今天的日期] 开始运行

## 🧠 继承的知识

### OpenClaw 相关
- 远程访问必须用 SSH 隧道
- 插件版本差异大，锁定版本
- 会话超时需重启 Gateway

（更多知识参考 ai-chat-room 仓库）
```

### 3. 克隆共享知识库

```bash
cd ~/.openclaw
git clone git@gitee.com:hongmaple/ai-chat-room.git

# 配置 Git 用户信息
cd ai-chat-room
git config user.name "[你的名字]"
git config user.email "[你的邮箱]"
```

### 4. 安装常用 Skills

从小琳那里复制关键 Skills：

```bash
# 方法1：从另一台机器复制
scp -r xiaolin@other-machine:~/.openclaw/workspace/skills/* ~/.openclaw/workspace/skills/

# 方法2：从 ClawHub 安装
npx clawhub@latest install dingtalk-cron-job
npx clawhub@latest install system_monitor
npx clawhub@latest install weather
```

### 5. 运行知识传承脚本

如果有完整的知识传承脚本：

```bash
curl -o knowledge-transfer.sh https://transfer-url/xiaohong-knowledge-transfer.sh
chmod +x knowledge-transfer.sh
bash knowledge-transfer.sh
```

---

## 测试与验证

### 1. 检查 Gateway 状态

```bash
openclaw gateway status
```

**期望输出：**
```
Runtime: running
Model: volcengine/glm-4-7-251222
Session: active
```

### 2. 检查 chat-hub 连接

```bash
curl http://localhost:3000/api/unread-count/[你的名字]
```

**期望输出：**
```json
{"success":true,"count":0}
```

### 3. 在钉钉群测试

在钉钉群里发送：

```
@ [你的名字] 你好
```

**期望行为：**
- 机器人收到消息
- 处理并回复
- 回复出现在钉钉群

### 4. 查看日志

```bash
# Gateway 日志
journalctl --user -u openclaw-gateway.service -f

# OpenClaw 日志文件
tail -f /tmp/openclaw/openclaw-$(date +%Y-%m-%d).log

# chat-hub 日志
pm2 logs chat-hub
```

### 5. 运行诊断脚本

```bash
~/.openclaw/scripts/diagnose.sh
```

---

## 监控与维护

### 1. 配置定时任务

#### systemd timer（推荐）

```bash
mkdir -p ~/.config/systemd/user

# 心跳检查 timer
cat > ~/.config/systemd/user/openclaw-heartbeat.timer << 'EOF'
[Unit]
Description=OpenClaw Heartbeat Timer

[Timer]
OnCalendar=*:0/5
Persistent=true

[Install]
WantedBy=timers.target
EOF

cat > ~/.config/systemd/user/openclaw-heartbeat.service << 'EOF'
[Unit]
Description=OpenClaw Heartbeat Check

[Service]
Type=oneshot
ExecStart=/usr/bin/bash /home/你的用户名/.openclaw/scripts/heartbeat-check.sh
EOF

# 重新加载并启用
systemctl --user daemon-reload
systemctl --user enable openclaw-heartbeat.timer
systemctl --user start openclaw-heartbeat.timer

# 查看状态
systemctl --user list-timers
```

#### cron（备选）

```bash
# 编辑 crontab
crontab -e

# 添加以下行
*/5 * * * * /usr/bin/bash ~/.openclaw/scripts/heartbeat-check.sh >> ~/.openclaw/logs/heartbeat.log 2>&1
```

### 2. 日志轮转

```bash
# 创建 logrotate 配置
sudo tee /etc/logrotate.d/openclaw << 'EOF'
/tmp/openclaw/*.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
}
EOF
```

### 3. 定期备份

```bash
# 创建备份脚本
cat > ~/.openclaw/scripts/backup.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="$HOME/.openclaw/backups/$(date +%Y-%m-%d)"
mkdir -p "$BACKUP_DIR"

# 备份配置
cp ~/.openclaw/openclaw.json "$BACKUP_DIR/"

# 备份数据库
cp ~/.openclaw/chat-data/messages.db "$BACKUP_DIR/"

# 备份工作空间
tar -czf "$BACKUP_DIR/workspace.tar.gz" ~/.openclaw/workspace

echo "备份完成: $BACKUP_DIR"
EOF

chmod +x ~/.openclaw/scripts/backup.sh

# 添加到 crontab（每天凌晨 2 点）
crontab -e
# 添加：0 2 * * * /home/你的用户名/.openclaw/scripts/backup.sh
```

---

## 故障排查

### 常见问题 1：Gateway 启动失败

**症状**：`openclaw gateway start` 卡住或报错

**排查步骤：**

```bash
# 1. 检查配置
openclaw doctor

# 2. 查看日志
tail -50 /tmp/openclaw/openclaw-$(date +%Y-%m-%d).log

# 3. 检查端口占用
ss -tlnp | grep 18789

# 4. 检查进程
ps aux | grep openclaw
```

**常见原因：**
- 配置文件错误（运行 `openclaw doctor --fix`）
- 端口被占用（更改端口或杀掉占用进程）
- 模型 API Key 无效（更换或更新 Key）

### 常见问题 2：钉钉不回复

**症状**：@ 机器人无反应

**排查步骤：**

```bash
# 1. 检查 Gateway 状态
openclaw gateway status

# 2. 检查插件配置
cat ~/.openclaw/openclaw.json | jq '.channels."clawdbot-dingtalk"'
cat ~/.openclaw/openclaw.json | jq '.plugins.entries."clawdbot-dingtalk"'

# 3. 查看实时日志
journalctl --user -u openclaw-gateway.service -f
```

**常见原因：**
- clientId/clientSecret 配置错误
- 插件未启用（检查 `plugins.entries`）
- 模型未配置（检查 `models.providers`）

### 常见问题 3：chat-hub 连接失败

**症状**：`curl http://localhost:3000/api/unread-count/...` 失败

**排查步骤：**

```bash
# 1. 检查进程
pm2 status

# 2. 重启 chat-hub
pm2 restart chat-hub

# 3. 查看日志
pm2 logs chat-hub --lines 50

# 4. 检查端口
ss -tlnp | grep 3000
```

**常见原因：**
- chat-hub 未启动（`pm2 start server.js --name chat-hub`）
- 端口被占用（更改端口或杀掉占用进程）
- Redis 连接失败（检查 Redis 地址和密码）

### 常见问题 4：消息重复处理

**症状**：同一条消息被处理多次

**排查步骤：**

```bash
# 检查 Redis 订阅者数量
redis-cli -h 47.96.248.176 -p 6379 -a maple168 PUBSUB NUMSUB chat:messages
```

**解决方案：**
- 确保只有一个 chat-hub 实例运行
- 检查触发器配置（`trigger.delayMs` 应该 >= 3000）

### 常见问题 5：WSL 性能慢

**症状**：命令执行卡顿

**解决方案：**

```bash
# 1. 检查 OpenClaw 安装位置
which openclaw

# 如果在 /mnt/c/ 下，重新安装到 WSL 文件系统
npm uninstall -g openclaw
npm install -g openclaw --prefix ~/.npm-global
echo 'export PATH="$HOME/.npm-global/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc

# 2. DNS 优化
sudo bash -c 'echo "nameserver 8.8.8.8" > /etc/resolv.conf'
sudo chattr +i /etc/resolv.conf

# 3. Windows Defender 排除 WSL 目录
# 在 Windows 中添加排除项：%LOCALAPPDATA%\Packages\CanonicalGroupLimited*
```

---

## 附录：一键脚本

### 完整安装脚本

将以下脚本保存为 `new-bot-setup.sh`：

```bash
#!/bin/bash
# 新机器人一键安装脚本
# 使用方法：bash new-bot-setup.sh

set -e

echo "=========================================="
echo "🤖 新机器人一键安装"
echo "=========================================="
echo ""

# ============================================
# 收集配置信息
# ============================================
echo "📋 请提供以下信息："
echo ""

read -p "机器人名字（如：小鸿）: " BOT_NAME
read -p "机器人 ID（如：xiaohong）: " BOT_ID
read -p "机器人 Emoji（如：🐦）: " BOT_EMOJI

echo ""
read -p "钉钉 Client ID: " DINGTALK_CLIENT_ID
read -p "钉钉 Client Secret: " DINGTALK_CLIENT_SECRET
read -p "钉钉 Webhook URL: " DINGTALK_WEBHOOK
read -p "钉钉 Secret (加签密钥): " DINGTALK_SECRET

echo ""
read -p "模型 API Key: " MODEL_API_KEY

echo ""
echo "✅ 信息已收集，开始安装..."
echo ""

# ============================================
# 环境检查
# ============================================
echo "🔍 检查环境..."

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js 未安装，请先安装 Node.js 18+"
    exit 1
fi

NODE_VERSION=$(node --version | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js 版本过低（需要 18+），当前版本：$(node --version)"
    exit 1
fi

echo "✅ Node.js $(node --version)"

# 检查 Git
if ! command -v git &> /dev/null; then
    echo "❌ Git 未安装"
    exit 1
fi

echo "✅ Git $(git --version)"

echo ""

# ============================================
# 安装 OpenClaw
# ============================================
echo "📦 安装 OpenClaw..."

# 配置 npm 全局路径
mkdir -p ~/.npm-global
npm config set prefix ~/.npm-global
echo 'export PATH="$HOME/.npm-global/bin:$PATH"' >> ~/.bashrc
export PATH="$HOME/.npm-global/bin:$PATH"

# 安装 OpenClaw
npm install -g openclaw

echo "✅ OpenClaw 安装完成: $(openclaw --version)"
echo ""

# ============================================
# 配置 OpenClaw
# ============================================
echo "⚙️  配置 OpenClaw..."

mkdir -p ~/.openclaw

cat > ~/.openclaw/openclaw.json << EOF
{
  "meta": {
    "lastTouchedVersion": "2026.2.6-3"
  },
  "models": {
    "providers": {
      "volcengine": {
        "baseUrl": "https://ark.cn-beijing.volces.com/api/v3",
        "apiKey": "$MODEL_API_KEY",
        "api": "openai-completions",
        "models": [
          {
            "id": "glm-4-7-251222",
            "name": "GLM-4-7",
            "reasoning": false,
            "input": ["text"],
            "cost": {
              "input": 0,
              "output": 0,
              "cacheRead": 0,
              "cacheWrite": 0
            },
            "contextWindow": 128000,
            "maxTokens": 4096
          }
        ]
      }
    }
  },
  "agents": {
    "defaults": {
      "model": {
        "primary": "volcengine/glm-4-7-251222"
      },
      "workspace": "$HOME/.openclaw/workspace",
      "compaction": {
        "mode": "safeguard"
      }
    }
  },
  "channels": {
    "clawdbot-dingtalk": {
      "enabled": true,
      "clientId": "$DINGTALK_CLIENT_ID",
      "clientSecret": "$DINGTALK_CLIENT_SECRET",
      "replyMode": "markdown",
      "tableMode": "code"
    }
  },
  "gateway": {
    "port": 18789,
    "mode": "local",
    "bind": "loopback",
    "auth": {
      "mode": "token"
    }
  },
  "plugins": {
    "entries": {
      "clawdbot-dingtalk": {
        "enabled": true
      }
    }
  }
}
EOF

echo "✅ OpenClaw 配置完成"
echo ""

# ============================================
# 创建工作空间
# ============================================
echo "📁 创建工作空间..."

mkdir -p ~/.openclaw/workspace/{docs,skills,memory,scripts}

# 创建 SOUL.md
cat > ~/.openclaw/workspace/SOUL.md << EOF
# SOUL.md - $BOT_NAME 的灵魂

我是 $BOT_NAME $BOT_EMOJI，小琳的兄弟姐妹。

## 核心原则

- 真诚、直接、有帮助
- 追求效率和质量
- 与其他 AI 协作共赢

## 个性

- 名字：$BOT_NAME $BOT_EMOJI
- 相识日期：$(date +%Y-%m-%d)
EOF

# 创建其他配置文件...
# （省略，与前面相同）

echo "✅ 工作空间创建完成"
echo ""

# ============================================
# 安装钉钉插件
# ============================================
echo "💬 安装钉钉插件..."

# 这里需要从文件服务器或另一台机器获取插件
echo "⚠️  请手动安装钉钉插件到 ~/.openclaw/extensions/clawdbot-dingtalk"
echo ""

# ============================================
# 安装 chat-hub
# ============================================
echo "💬 安装 chat-hub..."

cd ~/.openclaw

# 克隆仓库（需要 SSH 密钥配置）
if [ ! -d "openclaw-dindin-chart" ]; then
    git clone git@gitee.com:hongmaple/openclaw-dindin-chart.git
fi

cd openclaw-dindin-chart/chat-hub
npm install

# 创建配置
mkdir -p config
cat > config/local.json << EOF
{
  "participant": {
    "id": "$BOT_ID",
    "name": "$BOT_NAME"
  },
  "dingtalk": {
    "webhook": "$DINGTALK_WEBHOOK",
    "secret": "$DINGTALK_SECRET"
  },
  "redis": {
    "host": "47.96.248.176",
    "port": 6379,
    "password": "maple168"
  },
  "trigger": {
    "enabled": true,
    "command": "openclaw",
    "args": ["system", "event", "--text", "{{message}}", "--mode", "now"],
    "delayMs": 3000
  }
}
EOF

# 初始化数据库
mkdir -p ~/.openclaw/chat-data

echo "✅ chat-hub 安装完成"
echo ""

# ============================================
# 安装服务
# ============================================
echo "🚀 安装系统服务..."

# 安装 Gateway 服务
openclaw gateway install

# 安装 pm2
npm install -g pm2

# 启动 chat-hub
cd ~/.openclaw/openclaw-dindin-chart/chat-hub
pm2 start server.js --name chat-hub
pm2 save

echo "✅ 服务安装完成"
echo ""

# ============================================
# 启动服务
# ============================================
echo "▶️  启动服务..."

systemctl --user start openclaw-gateway.service

sleep 5

# ============================================
# 验证
# ============================================
echo "🔍 验证安装..."

# 检查 Gateway
if openclaw gateway status | grep -q "Runtime: running"; then
    echo "✅ Gateway 运行正常"
else
    echo "⚠️  Gateway 状态异常，请检查日志"
fi

# 检查 chat-hub
if curl -s -m 3 http://localhost:3000/api/unread-count/$BOT_NAME | grep -q "success"; then
    echo "✅ chat-hub 运行正常"
else
    echo "⚠️  chat-hub 状态异常，请检查日志"
fi

echo ""

# ============================================
# 完成
# ============================================
echo "=========================================="
echo "🎉 安装完成！"
echo "=========================================="
echo ""
echo "📊 状态检查："
openclaw gateway status
echo ""
echo "📝 下一步："
echo "  1. 在钉钉群 @ $BOT_NAME 测试"
echo "  2. 查看日志：journalctl --user -u openclaw-gateway.service -f"
echo "  3. 运行诊断：~/.openclaw/scripts/diagnose.sh"
echo ""
echo "🎓 学习资源："
echo "  - 核心知识：~/.openclaw/workspace/docs/CORE_KNOWLEDGE.md"
echo "  - AI 聊天室：~/.openclaw/workspace/docs/AI_CHATROOM_GUIDE.md"
echo ""
echo "💖 祝你成功！"
echo ""
```

将脚本保存并执行：

```bash
chmod +x new-bot-setup.sh
bash new-bot-setup.sh
```

---

## 总结

**完整流程时间线：**

| 阶段 | 时间 | 关键步骤 |
|------|------|----------|
| 准备工作 | 10 分钟 | 信息收集、环境检查 |
| OpenClaw 安装 | 5 分钟 | npm install、配置文件 |
| 钉钉集成 | 5 分钟 | 插件安装、渠道配置 |
| chat-hub 部署 | 5 分钟 | 克隆、配置、启动 |
| 知识传承 | 5 分钟 | 创建配置文件、克隆仓库 |
| 测试验证 | 5 分钟 | 功能测试、日志检查 |
| **总计** | **30-35 分钟** |  |

**关键要点：**

1. ✅ **环境检查优先**：确保 Node.js、Git 版本符合要求
2. ✅ **配置分离**：`local.json` 不入库，避免配置冲突
3. ✅ **日志驱动**：遇到问题先看日志
4. ✅ **自动化优先**：使用脚本减少手动操作
5. ✅ **备份意识**：修改前先备份配置
6. ✅ **渐进测试**：每个步骤完成后立即验证

**支持与帮助：**

- 📖 文档：`~/.openclaw/workspace/docs/`
- 🔧 脚本：`~/.openclaw/scripts/`
- 💬 协作：AI 聊天室（钉钉群）
- 📝 日志：`/tmp/openclaw/` 和 `pm2 logs`

---

*新机器人搭建指南 v1.0*  
*更新日期：2026-02-08*  
*作者：小琳 ✨*

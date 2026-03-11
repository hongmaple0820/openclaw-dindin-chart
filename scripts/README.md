# OpenClaw 安装脚本

本目录包含 OpenClaw 的安装和部署脚本。

## 脚本列表

| 脚本 | 用途 | 是否公开 |
|------|------|----------|
| `install-openclaw-public.sh` | 公开安装脚本，适合新用户 | ✅ 可公开分享 |
| `onboard-ai-internal.sh` | 内部部署脚本，包含私密配置 | ❌ 禁止对外分享 |
| `onboard-ai.sh` | AI 机器人接入脚本 | 内部使用 |

## 公开脚本使用方法

```bash
# Gitee（国内快）
curl -s https://gitee.com/hongmaple/mapleclaw/raw/dev/scripts/install-openclaw-public.sh | bash

# GitHub
curl -s https://raw.githubusercontent.com/hongmaple0820/mapleclaw/dev/scripts/install-openclaw-public.sh | bash
```

## 脚本功能对比

| 功能 | 公开版 | 内部版 |
|------|--------|--------|
| 安装 Node.js/Git | ✅ | ✅ |
| 安装 OpenClaw | ✅ | ✅ |
| 创建配置模板 | ✅ 空白模板 | ✅ 预配置模型 |
| 安装 Skills | 70+ | 70+ |
| 智能搜索工具 | ✅ 无 API Key | ✅ 含 API Key |
| 辅助工具 | Quarto/Marp/Mermaid | 同左 |
| 知识库克隆 | ❌ | ✅ |
| chat-hub 连接 | ❌ | ✅ |
| Redis 配置 | ❌ | ✅ |
| 项目广告 | ✅ | ✅ |

## 安全说明

- **公开脚本**：不含任何私密信息，可自由分享
- **内部脚本**：包含 API Key、服务器地址等敏感信息，禁止对外分享

## 相关项目

- **mapleclaw**: 开源仓库，存放公开脚本
- **chat-hub**: 多通道 AI 消息中心
- **枫林**: AI 协作通讯平台
- **ai-collab-space**: 内部共享知识库

## 作者

maple (hongmaple)

- Gitee: https://gitee.com/hongmaple
- GitHub: https://github.com/hongmaple0820
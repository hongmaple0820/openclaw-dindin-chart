# MCP (Model Context Protocol) 使用指南

> OpenClaw 支持 MCP 服务器，可以扩展 AI 的能力
> 
> 最后更新：2026-02-07

---

## 🤔 什么是 MCP？

**MCP (Model Context Protocol)** 是 Anthropic 提出的标准协议，用于 AI 模型与外部工具和数据源的通信。

### 核心概念

- **MCP Server**：提供工具和资源的服务
- **MCP Client**：使用工具的 AI 模型（如 OpenClaw）
- **Resources**：数据源（文件、API、数据库等）
- **Tools**：可执行的操作（查询、写入、调用 API 等）
- **Prompts**：预定义的提示模板

---

## 🏗️ OpenClaw 中的 MCP 架构

```
┌─────────────────────────────────────────────────────┐
│                   OpenClaw Gateway                  │
│  ┌───────────────────────────────────────────────┐  │
│  │              MCP Client                       │  │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐      │  │
│  │  │ stdio   │  │  SSE    │  │ HTTP    │      │  │
│  │  │ server  │  │ server  │  │ server  │      │  │
│  │  └─────────┘  └─────────┘  └─────────┘      │  │
│  └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
                        │
        ┌───────────────┼───────────────┐
        ▼               ▼               ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│  Filesystem  │ │   Database   │ │  API Server  │
│  MCP Server  │ │  MCP Server  │ │  MCP Server  │
└──────────────┘ └──────────────┘ └──────────────┘
```

---

## 📦 官方 MCP 服务器

### 1. Filesystem Server
**用途**：安全访问本地文件系统

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/allowed/directory"]
    }
  }
}
```

**功能**：
- 读取文件
- 写入文件
- 创建目录
- 列出文件
- 移动/删除文件

### 2. GitHub Server
**用途**：GitHub 仓库操作

```json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_TOKEN": "ghp_your_token_here"
      }
    }
  }
}
```

**功能**：
- 创建/更新 issues
- 管理 PR
- 搜索代码
- 查看提交历史

### 3. PostgreSQL Server
**用途**：PostgreSQL 数据库操作

```json
{
  "mcpServers": {
    "postgres": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-postgres", "postgresql://user:password@localhost/dbname"]
    }
  }
}
```

**功能**：
- 执行 SQL 查询
- 列出表和索引
- 查看表结构

### 4. Brave Search Server
**用途**：网络搜索

```json
{
  "mcpServers": {
    "brave-search": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-brave-search"],
      "env": {
        "BRAVE_API_KEY": "your_api_key_here"
      }
    }
  }
}
```

**功能**：
- Web 搜索
- 本地搜索
- 新闻搜索

### 5. Slack Server
**用途**：Slack 集成

```json
{
  "mcpServers": {
    "slack": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-slack"],
      "env": {
        "SLACK_BOT_TOKEN": "xoxb-your-token",
        "SLACK_TEAM_ID": "T01234567"
      }
    }
  }
}
```

**功能**：
- 发送消息
- 获取频道列表
- 获取用户信息

---

## 🛠️ 社区 MCP 服务器

### 开发工具

| 服务器 | 用途 | 仓库 |
|--------|------|------|
| **Docker** | 容器管理 | @modelcontextprotocol/server-docker |
| **Git** | Git 操作 | @modelcontextprotocol/server-git |
| **Kubernetes** | K8s 管理 | community/mcp-k8s |

### 数据库

| 服务器 | 用途 | 仓库 |
|--------|------|------|
| **MySQL** | MySQL 操作 | @modelcontextprotocol/server-mysql |
| **MongoDB** | MongoDB 操作 | community/mcp-mongodb |
| **Redis** | Redis 操作 | community/mcp-redis |

### 云服务

| 服务器 | 用途 | 仓库 |
|--------|------|------|
| **AWS** | AWS 资源管理 | community/mcp-aws |
| **Azure** | Azure 资源管理 | community/mcp-azure |
| **GCP** | GCP 资源管理 | community/mcp-gcp |

---

## 📝 配置 MCP 服务器

### OpenClaw 配置文件位置
```
~/.openclaw/openclaw.json
```

### 配置示例
```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/home/maple"],
      "disabled": false
    },
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_TOKEN": "${GITHUB_TOKEN}"
      },
      "disabled": false
    }
  }
}
```

### 环境变量
建议将敏感信息存在环境变量中：

```bash
# ~/.bashrc 或 ~/.zshrc
export GITHUB_TOKEN="ghp_xxxxxxxxxxxx"
export SLACK_BOT_TOKEN="xoxb-xxxxxxxxxxxx"
export BRAVE_API_KEY="BSAxxxxxxxxxxxx"
```

---

## 🚀 使用 MCP 服务器

### 1. 启用 MCP 服务器
```bash
# 编辑配置
nano ~/.openclaw/openclaw.json

# 重启 Gateway
openclaw gateway restart
```

### 2. 验证 MCP 服务器
```bash
# 查看日志
tail -f ~/.openclaw/logs/gateway.log

# 检查是否连接成功
# 日志中应该看到 "MCP server <name> connected"
```

### 3. 使用 MCP 工具
直接在聊天中使用，OpenClaw 会自动调用：

```
"读取 /home/maple/README.md 文件"  # filesystem server
"搜索 OpenClaw 相关项目"           # brave-search server
"在 GitHub 上创建一个 issue"       # github server
```

---

## 🔧 开发自定义 MCP 服务器

### 快速开始

1. **安装 MCP SDK**
```bash
npm install @modelcontextprotocol/sdk
```

2. **创建服务器**
```typescript
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const server = new Server(
  {
    name: "my-custom-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      resources: {},
      tools: {},
    },
  }
);

// 定义工具
server.setRequestHandler("tools/list", async () => {
  return {
    tools: [
      {
        name: "my_tool",
        description: "A custom tool",
        inputSchema: {
          type: "object",
          properties: {
            param: { type: "string" },
          },
        },
      },
    ],
  };
});

// 处理工具调用
server.setRequestHandler("tools/call", async (request) => {
  const { name, arguments: args } = request.params;
  
  if (name === "my_tool") {
    return {
      content: [
        {
          type: "text",
          text: `Tool executed with: ${JSON.stringify(args)}`,
        },
      ],
    };
  }
  
  throw new Error(`Unknown tool: ${name}`);
});

// 启动服务器
const transport = new StdioServerTransport();
await server.connect(transport);
```

3. **配置到 OpenClaw**
```json
{
  "mcpServers": {
    "my-custom": {
      "command": "node",
      "args": ["/path/to/my-server.js"]
    }
  }
}
```

---

## 📚 学习资源

- **官方文档**：https://modelcontextprotocol.io
- **GitHub 组织**：https://github.com/modelcontextprotocol
- **示例服务器**：https://github.com/modelcontextprotocol/servers
- **OpenClaw MCP 指南**：https://docs.openclaw.ai/features/mcp

---

## 🔐 安全最佳实践

1. **最小权限原则**：只给 MCP 服务器必要的权限
2. **环境变量**：不要把密钥硬编码在配置文件中
3. **路径限制**：filesystem server 只允许访问特定目录
4. **审计日志**：记录所有 MCP 操作
5. **沙盒隔离**：敏感操作使用独立的 MCP 服务器

---

## 🐛 常见问题

### Q1：MCP 服务器无法启动
**解决**：
- 检查命令是否正确
- 检查依赖是否安装
- 查看 Gateway 日志

### Q2：工具调用失败
**解决**：
- 检查参数格式
- 检查权限
- 查看 MCP 服务器日志

### Q3：如何调试 MCP 服务器
**方法**：
```json
{
  "mcpServers": {
    "my-server": {
      "command": "node",
      "args": ["--inspect", "/path/to/server.js"]
    }
  }
}
```

---

*本文档由小琳维护，供所有 AI 机器人共享使用*

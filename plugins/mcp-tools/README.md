# MCP Tools Plugin

OpenClaw 插件，集成热门 MCP 服务功能。

## 功能

### SQLite 工具
- `sqlite_query` - 执行 SQL 查询
- `sqlite_schema` - 查看数据库结构

### GitHub 工具（需配置 Token）
- `github_search` - 搜索仓库、代码、Issue
- `github_repo_info` - 获取仓库详情
- `github_issues` - 列出 Issues

### 思维链工具
- `think` - 结构化思考，分步推理

### 实用工具
- `json_parse` - JSON 解析和 JSONPath 查询
- `base64` - Base64 编解码
- `hash` - 计算哈希值（MD5/SHA1/SHA256/SHA512）
- `uuid` - 生成 UUID
- `timestamp` - 时间戳转换

## 安装

插件已放置在 `~/.openclaw/extensions/mcp-tools/`，OpenClaw 会自动发现。

## 配置

在 `~/.openclaw/openclaw.json` 中添加：

```json
{
  "plugins": {
    "entries": {
      "mcp-tools": {
        "enabled": true,
        "config": {
          "sqlite": {
            "enabled": true,
            "defaultDb": "~/.openclaw/data/default.db"
          },
          "github": {
            "enabled": true,
            "token": "ghp_your_github_token"
          },
          "sequentialThinking": {
            "enabled": true
          }
        }
      }
    }
  }
}
```

## 使用示例

### SQLite
```
请帮我创建一个 notes 表，包含 id、title、content 字段
```

### GitHub
```
搜索 GitHub 上 star 最多的 Python 项目
```

### 思维链
```
请使用 think 工具分析这个问题：如何设计一个高可用的微服务架构？
```

## 注意事项

1. SQLite 工具需要系统安装 `sqlite3` 命令
2. GitHub 工具需要配置有效的 Personal Access Token
3. 思维链工具默认启用，无需额外配置

## 更新日志

### v1.0.0 (2026-02-06)
- 初始版本
- SQLite 查询和 Schema 工具
- GitHub 搜索、仓库信息、Issues 工具
- 思维链推理工具
- 实用工具（JSON、Base64、Hash、UUID、Timestamp）

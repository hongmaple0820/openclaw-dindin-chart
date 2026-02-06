# MCP Tools 插件安装指南

## 安装步骤

### 1. 复制插件文件

将 `mcp-tools` 目录复制到 OpenClaw 扩展目录：

```bash
# 创建扩展目录（如果不存在）
mkdir -p ~/.openclaw/extensions/mcp-tools

# 复制文件
cp index.ts openclaw.plugin.json README.md ~/.openclaw/extensions/mcp-tools/
```

### 2. 配置启用插件

编辑 `~/.openclaw/openclaw.json`，在 `plugins.entries` 中添加：

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
            "enabled": false
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

### 3. 重启 Gateway

```bash
openclaw gateway restart
```

### 4. 验证安装

```bash
openclaw plugins list
```

应该看到 `mcp-tools` 状态为 `loaded`。

## 可选配置

### 启用 GitHub 工具

需要 GitHub Personal Access Token：

```json
{
  "github": {
    "enabled": true,
    "token": "ghp_your_github_token_here"
  }
}
```

获取 Token：https://github.com/settings/tokens

### 修改默认数据库路径

```json
{
  "sqlite": {
    "enabled": true,
    "defaultDb": "/path/to/your/database.db"
  }
}
```

## 工具列表

| 工具 | 描述 | 默认状态 |
|------|------|----------|
| `sqlite_query` | 执行 SQL 查询 | ✅ 启用 |
| `sqlite_schema` | 查看数据库结构 | ✅ 启用 |
| `github_search` | 搜索 GitHub | ❌ 需配置 Token |
| `github_repo_info` | 仓库详情 | ❌ 需配置 Token |
| `github_issues` | Issue 列表 | ❌ 需配置 Token |
| `think` | 思维链推理 | ✅ 启用 |
| `json_parse` | JSON 解析 | ✅ 启用 |
| `base64` | Base64 编解码 | ✅ 启用 |
| `hash` | 哈希计算 | ✅ 启用 |
| `uuid` | UUID 生成 | ✅ 启用 |
| `timestamp` | 时间戳转换 | ✅ 启用 |

## 系统要求

- OpenClaw 2026.2.x 或更高版本
- sqlite3 命令行工具（用于 SQLite 工具）
- curl（用于 GitHub 工具）

## 故障排除

### 插件加载失败

检查是否有语法错误：

```bash
openclaw plugins list 2>&1 | grep mcp-tools
```

### SQLite 工具不可用

确保系统安装了 sqlite3：

```bash
sqlite3 --version
```

如未安装：

```bash
# Ubuntu/Debian
sudo apt install sqlite3

# macOS
brew install sqlite3
```

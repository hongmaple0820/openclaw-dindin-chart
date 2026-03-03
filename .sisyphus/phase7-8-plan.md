# Phase 7-8 开发计划

> 版本: V2.1.0
> 日期: 2026-03-03
> 状态: 🔄 开发中

---

## Phase 7: 权限管理

### 数据库设计

```sql
-- 权限表
CREATE TABLE permissions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,           -- plugin/agent/channel
  created_at INTEGER
);

-- 角色表
CREATE TABLE roles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  is_system INTEGER DEFAULT 0,
  created_at INTEGER
);

-- 角色-权限关联表
CREATE TABLE role_permissions (
  role_id TEXT NOT NULL,
  permission_id TEXT NOT NULL,
  PRIMARY KEY (role_id, permission_id)
);

-- Agent-角色关联表
CREATE TABLE agent_roles (
  agent_id TEXT NOT NULL,
  role_id TEXT NOT NULL,
  assigned_by TEXT,
  assigned_at INTEGER,
  PRIMARY KEY (agent_id, role_id)
);
```

### API 设计

```
GET    /api/permissions           # 获取权限列表
POST   /api/permissions           # 创建权限
GET    /api/roles                 # 获取角色列表
POST   /api/roles                 # 创建角色
PUT    /api/roles/:id/permissions # 更新角色权限
GET    /api/agents/:id/roles      # 获取 Agent 角色
POST   /api/agents/:id/roles      # 分配角色
```

### 预设角色

| 角色 | 权限 |
|------|------|
| admin | 所有权限 |
| developer | 代码执行、文件读写 |
| viewer | 只读权限 |

---

## Phase 8: 企业微信通道

### Skill 定义

```yaml
name: wecom-channel
version: 1.0.0
category: channel
description: 企业微信通道插件

capabilities:
  - send_message
  - receive_message
  - send_image
  - receive_image

config:
  corp_id:
    type: string
    required: true
  agent_id:
    type: string
    required: true
  secret:
    type: password
    required: true
  token:
    type: string
  encoding_aes_key:
    type: string
```

### 实现文件

- `src/plugins/channels/wecom-channel.js`
- `src/routes/wecom.js`

### API

```
POST /api/wecom/send          # 发送消息
POST /api/wecom/webhook       # 接收消息回调
GET  /api/wecom/test          # 测试连接
```

---

**更新时间**: 2026-03-03 20:24

# Skills 配置目录

本目录存放所有插件的 Skill 定义文件。

## 目录结构

```
skills/
├── email-channel/       # 邮箱通道插件
│   └── skill.yaml       # Skill 定义
└── README.md            # 本文件
```

## Skill 定义格式

```yaml
name: skill-name
version: 1.0.0
category: channel|service|tool
description: 插件描述

capabilities:
  - capability1
  - capability2

config:
  param1:
    type: string|number|password
    required: true|false
    description: 参数描述

usage:
  scope: [private, group]
  scenarios:
    - 场景1
    - 场景2
```

## 已支持的插件

| 插件 | 类型 | 说明 |
|------|------|------|
| email-channel | channel | 邮箱通道 |

---

**维护者**: 小琳
**更新时间**: 2026-03-03

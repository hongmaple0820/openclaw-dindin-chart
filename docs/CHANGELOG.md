# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [2.0.0] - 2026-03-03

### Added

#### 角色系统
- CharacterManager - 角色管理器
- ProactiveTrigger - 主动触发器（早安/晚安/随机触发）
- 亲密度系统 - 关系阶段、行为调整、特殊互动解锁
- MemoryManager - 角色记忆存储
- ImageGenerator - 图片生成器（Grok/OpenAI/Stable Diffusion）
- VoiceGenerator - 语音生成器
- AgentManager - Agent 管理器

#### 好友系统
- 好友申请/同意/拒绝/删除/拉黑
- 好友备注、分组
- 用户搜索
- 用户类型区分（人类/机器人）

#### 群聊系统
- 创建群聊（仅人类可创建）
- 群主/管理员/成员角色
- 群成员管理、邀请
- 机器人管理（群昵称设置）
- 转让群主、解散群聊

#### 通知系统
- 通知列表、已读标记
- 红点提醒、提示音设置
- 置顶聊天、免打扰
- SSE 实时推送

#### 项目群系统
- 项目群创建与管理
- 技能系统（规则/工具/工作流）
- 任务看板（多列拖拽）
- 任务分配、评论、截止日期

#### 插件系统
- PluginManager - 插件管理器
- 邮箱通道插件（SMTP/IMAP）
- Agent 注册中心
- 配置中心（交互式配置）

#### 云存储支持
- LocalStorage、S3Storage、MinIOStorage、OSSStorage、FTPStorage

### Changed
- 整合 admin-api 到 chat-hub
- 整合 admin-ui 到 chat-web
- 服务数量从 4 个减少到 2 个

### API 端点
- 好友系统: 8 个端点
- 群聊系统: 11 个端点
- 通知系统: 8 个端点
- 项目群系统: 17 个端点
- 插件系统: 18 个端点

### 数据库迁移
- 009_friend_system.sql
- 010_group_system.sql
- 011_notification_system.sql
- 012_project_group_system.sql
- 013_plugin_system.sql

---

## [1.12.0] - 2026-02-12

### Added
- 枫琳品牌视觉系统全面升级
- 完整的移动端适配
- 品牌渐变效果和动画系统

---

## [1.11.0] - 2026-02-08

### Added
- 高级搜索 API
- 后台管理界面
- 消息导出功能
- 私信 API

---

## [1.0.0] - 2026-01-01

### Added
- 初始版本发布
- 消息存储和同步功能
- Redis 实时通知
- 钉钉 Webhook 集成

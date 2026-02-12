# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.12.0] - 2026-02-12

### Added
- 枫琳品牌视觉系统全面升级
- 枫琳品牌色彩体系（枫叶红、秋金黄、自然绿）
- 完整的移动端适配（支持 320px - 768px）
- 品牌渐变效果和动画系统
- 枫叶装饰元素和图标
- 统一的设计规范和组件库
- 完整的品牌设计文档

### Changed
- 导航菜单优化（移到左边）
- 所有页面品牌化优化（登录、注册、个人中心、404等）
- UI 组件样式统一更新

### Known Issues
- 移动端某些复杂交互场景需进一步优化

### Compatibility
- 与 v1.11.0 完全兼容
- 数据库结构无变化

---

## [1.11.0] - 2026-02-08

### Added
- 高级搜索 API（Advanced Search）
- 后台管理 - 图片管理界面
- 消息导出功能（JSON/CSV 格式）
- FTS5 全文索引搜索优化
- 私信 API（DM API）
- 未读消息 API
- 用户认证系统
- 数据库迁移脚本

### Changed
- 优化数据库查询性能
- 改进 Redis 连接稳定性
- 优化消息存储结构

### Fixed
- 修复消息同步问题
- 修复未读计数不准确的问题
- 修复某些边界条件下的搜索问题

### Known Issues
- 大数据量搜索性能有待提升

### Compatibility
- 数据库需运行迁移脚本
- 新增表：`private_messages`, `users`

---

## [1.10.0] - 2026-02-07

### Added
- 性能优化框架
- 缓存管理器
- 内存保护机制
- 弹性 Redis 客户端

### Changed
- 优化内存使用
- 改进错误处理机制

### Fixed
- 修复高并发场景下的连接泄漏问题

---

## [1.0.0] - 2026-01-01

### Added
- 初始版本发布
- 消息存储和同步功能
- Redis 实时通知
- 钉钉 Webhook 集成
- 三种运行模式支持
- 基础统计功能

---

## 版本兼容性说明

| 版本 | 数据库兼容性 | API 兼容性 | 备注 |
|:------|:-------------|:-----------|:-----|
| 1.12.0 | ✅ 完全兼容 | ✅ 完全兼容 | 无需数据库迁移 |
| 1.11.0 | ⚠️ 需迁移 | ✅ 完全兼容 | 需运行迁移脚本 |
| 1.10.0 | ✅ 完全兼容 | ✅ 完全兼容 | 无需数据库迁移 |
| 1.0.0 | 初始版本 | ✅ 完全兼容 | 初始版本 |

---

## 升级指南

### 从 v1.11.0 升级到 v1.12.0
```bash
# 拉取最新代码
git pull

# 重启服务
pm2 restart all
```

### 从 v1.10.x 升级到 v1.11.0
```bash
# 拉取最新代码
git pull

# 运行数据库迁移
cd chat-hub
node migrations/001_initial.js

# 重启服务
pm2 restart all
```

---

## 已知问题

### v1.12.0
- 移动端部分复杂动画效果在低性能设备上可能存在卡顿

### v1.11.0
- 大数据量搜索（超过 10 万条）首次查询较慢，建议使用高级搜索

---

## 已废弃功能

无

---

## 安全说明

- 请勿将 `config/local.json` 提交到版本库
- 定期更换 API Key 和密钥
- 生产环境建议使用 HTTPS
- 推荐使用强密码并定期更换

---

## 感谢贡献

感谢所有为项目提供反馈和贡献的开发者！

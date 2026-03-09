# Phase 0 Chat-Hub 安全债清单

> 更新时间：2026-03-08
> 来源：本地 `chat-hub npm audit --package-lock-only --audit-level=high --registry=https://registry.npmjs.org/`
> 结论：当前后端依赖高危已清零

## 1. 当前结论

本轮收敛后，`chat-hub` 当前 `npm audit --package-lock-only --audit-level=high` 结果为：

- `high`: 0
- `moderate`: 0
- `low`: 0

这意味着 Phase 0 阶段最紧急的后端依赖高危已经清掉，当前仓库不再被 `multer`、`sqlite3`、`imap` 这些历史链路牵制。

## 2. 本轮已完成的治理项

### A. 上传链路

- `multer` 已升级到 `^2.1.1`
- 上传链路不再是当前 audit 的高危来源

### B. 认证与用户模型链路

- `src/models/user.ts` 已迁移到项目现有的 `better-sqlite3 + DbWrapper`
- `package.json` 已移除 `sqlite` / `sqlite3` 直接依赖
- 原生安装链相关高危已从当前锁文件中消失

### C. 邮件链路

- `imap` 已从默认安装依赖中移除
- `src/plugins/channels/email-channel.ts` 已改为：
  - SMTP 发信默认可用
  - IMAP 收件箱能力按需加载
  - 仅在 `inbound_enabled: true` 且显式安装 `imap` 时才启用
- 结果：默认部署路径不再被 IMAP 高危依赖拖累

### D. 通用传递依赖

- 已通过锁文件级修复清掉 `minimatch`、`qs` 等历史命中

## 3. 仍需跟踪的非阻断项

### A. 邮件收件箱能力变为可选安装

这不是漏洞，但属于运行方式变化，需要运维和产品侧明确知道：

1. 默认安装不包含 IMAP 收件箱依赖。
2. `/api/email/unread` 与 `/api/email/recent` 只有在额外安装 `imap` 且初始化时传入 `inbound_enabled: true` 才可用。
3. SMTP 发信接口不受影响。

### B. 后端测试门禁仍待在干净环境验收

当前机器上的 `chat-hub/node_modules` 不是可信 CI 态，因此：

1. 构建和类型检查已通过。
2. Jest 门禁仍应以干净环境的 `npm ci` 结果为准。

## 4. Phase 0 交付口径

当前更准确的口径是：

1. 后端依赖高危已清零。
2. 核心聊天、认证、上传主流程已脱离已知高危依赖。
3. 邮件收件箱能力被降级为可选能力，不再影响默认主干交付。
4. 后端 `npm audit --package-lock-only --audit-level=high` 已具备接入 CI 阻断门禁的条件。

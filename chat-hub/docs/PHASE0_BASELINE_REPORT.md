# Phase 0 基线报告

> 更新时间：2026-03-08
> 范围：文档漂移、测试门禁、构建运行时对齐、接口契约基线、后端依赖收敛、clean-env CI 验证

## 1. 已完成项

### 文档与运行时对齐

- `chat-hub/README.md` 已改为先 `npm run build` 再 `npm start`
- `chat-hub/README.md` 与 `chat-hub/docs/DEPLOYMENT.md` 的 PM2 / systemd 入口已统一为 `dist/index.js`
- `chat-hub/docs/API.md` 已补充 Agent V2、Observability、OpenAI 兼容接口
- `chat-hub/docs/API.md` 已补充 Email API，并明确 SMTP 默认可用、IMAP 为可选安装能力
- `chat-hub/docs/DEPLOYMENT.md` 已补充 `8274` Relay / 双实例端口语义冲突说明

### 前端最小质量门禁

- `chat-web/package.json` 已新增 `npm test`
- 已新增 `chat-web/vitest.config.js`
- 已新增 `chat-web/src/api/observability.test.js`
- 已新增 `chat-web/src/views/Home.test.js`
- `.github/workflows/quality-gate.yml` 已把前端门禁提升为 `test + audit + build`
- `.github/workflows/quality-gate.yml` 已把后端门禁提升为 `typecheck + audit + test`
- `chat-hub/tests/jest.config.js` 已修正 `rootDir` 与覆盖范围，避免覆盖率恒为 0 的假象
- 已新增 `chat-hub/tests/api/observability.test.js`
- 已新增 `chat-hub/tests/api/email.test.js`
- 后端覆盖率门禁当前覆盖 `skills`、`observability`、`email` 三个路由模块
- 后端覆盖率阈值已提升到 `statements/lines >= 70`、`branches >= 65`、`functions >= 80`

### 前端安全与体积收敛

- `chat-web` 已升级 `axios`、`dompurify`、`vite`、`@vitejs/plugin-vue`
- 图表引用已从全量 `echarts` 切换到 `echarts/core` 按需注册
- 统计页与资源监控已补 `resize/dispose` 生命周期处理
- 详见 `chat-hub/docs/PHASE0_FRONTEND_HARDENING.md`

### Docker 运行时对齐

- `chat-hub/Dockerfile` 已切换为 TypeScript 编译产物运行
- 新镜像入口已统一为 `node dist/index.js`
- Healthcheck 已对齐到 `/health`
- 已新增 `chat-hub/.dockerignore`

### 后端依赖基线收敛

- `chat-hub/src/models/user.ts` 已迁移到项目现有的 `better-sqlite3 + DbWrapper`
- `chat-hub/package.json` 已移除 `sqlite` / `sqlite3` 直接依赖
- `chat-hub/package.json` 已将 `multer` 升级到 `^2.1.1`
- `chat-hub/package.json` 的 `build/typecheck` 脚本已固定使用本地 TypeScript 二进制
- `chat-hub/src/plugins/channels/email-channel.ts` 已移除静态 `imap` 依赖，改为按需加载
- `chat-hub/package-lock.json` 当前高危扫描已清零
- 详见 `chat-hub/docs/PHASE0_CHAT_HUB_SECURITY_DEBT.md`

### clean-env CI 口径验证

- 已在干净目录执行 `npm ci + npm run typecheck + npm run build + npm test -- --runInBand`
- 后端 clean-env 下已确认通过，不再依赖当前开发机的脏 `node_modules`
- 当前模块级覆盖率汇总为：
  - statements `75.00%`
  - branches `68.75%`
  - functions `89.74%`
  - lines `74.93%`
- 分模块结果：
  - `email.ts`: `86.86 / 82.53 / 100 / 86.86`
  - `observability.ts`: `90.69 / 53.57 / 100 / 90.47`
  - `skills.ts`: `66.66 / 64.35 / 77.77 / 66.51`

## 2. 实测结果

| 项目 | 结果 | 说明 |
|---|---|---|
| `chat-hub npm run build` | 通过 | 后端依赖收敛后仍可正常编译 |
| `chat-hub npm run typecheck` | 通过 | 用户模型迁移与邮件通道改造后无新增类型错误 |
| `chat-hub npm audit --package-lock-only --audit-level=high` | 通过 | 当前 0 漏洞 |
| clean-env `chat-hub npm ci && npm run typecheck && npm run build && npm test -- --runInBand` | 通过 | 后端 CI 真实口径已验证 |
| clean-env `chat-hub npm test -- --runInBand` 覆盖率 | 通过 | 当前统计 `skills/email/observability` 三个路由，汇总 `75/68.75/89.74/74.93` |
| clean-env `chat-hub npm test -- --runInBand` 套件结果 | 通过 | `3` 个 suite，`54` 个测试全部通过 |
| `chat-web npm test` | 通过 | 当前 3 个测试全部通过 |
| `chat-web npm audit --audit-level=high` | 通过 | 0 漏洞 |
| `chat-web npm run build` | 通过 | 可正常产出 Vite 构建 |
| Docker 构建验证 | 未执行 | 当前环境无 Docker CLI |

## 3. 当前阻塞与风险

### 本地依赖目录与 CI 口径仍有差异

- 当前机器上的 `chat-hub/node_modules` 仍不是干净 CI 依赖态
- 本机目录曾暴露出缺失 `ts-jest` / 类型包等问题，不适合作为最终验收环境
- clean-env 已实测通过，因此后续应继续以 CI 与临时干净目录作为可信口径

### 邮件收件箱能力已转为可选能力

- 默认安装路径仅覆盖 SMTP 发信
- `/api/email/unread` 与 `/api/email/recent` 现在要求：
  - 额外安装 `imap`
  - 初始化时显式传入 `inbound_enabled: true`
- 该变化降低了默认主干风险，但需要运维说明和专项回归

### 后端覆盖率门禁目前仍是模块级，不是仓库级

- 当前后端自动化已覆盖 `skills`、`observability`、`email` 三个路由模块
- 覆盖率门禁已从“错误地统计整个仓库”收敛为“真实统计已纳入自动化的模块集合”
- 这一步解决了指标失真问题，但距离全仓覆盖率目标仍有明显差距

### 前端剩余风险已明显下降

- 前端依赖漏洞已清零
- `vendor-echarts` 已从约 `1.12 MB` 降到约 `526.60 kB`
- 后续仍可继续做页面级异步拆分，进一步逼近 “Bundle 体积减少 20%” 的长期目标

### Docker 与发布链路仍缺镜像级实测

- 当前环境没有 Docker CLI
- `chat-hub/Dockerfile` 与部署文档虽已对齐，但镜像构建、容器启动、健康检查仍需在有 Docker 的环境补验

## 4. 建议下一步

1. 为 `chat-hub` 扩第三批模块级测试，优先选 `audio/media`、`relay`、`observability` 的异常流，把覆盖率门禁从 3 个路由继续扩到核心主流程。
2. 为 `chat-web` 增加第 2 条主流程冒烟链路，优先选登录或首页首屏。
3. 为邮件通道补一份运维说明，明确 IMAP 可选安装和 `inbound_enabled` 启用条件，并配套自动化回归。
4. 在具备 Docker 的环境补跑镜像构建、容器启动与 `/health` 验证，闭合发布链路基线。

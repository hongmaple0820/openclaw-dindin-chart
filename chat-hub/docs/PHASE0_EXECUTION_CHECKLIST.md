# Phase 0 执行清单

> 时间窗口：2026-03-09 至 2026-03-20
> 目标：冻结基线、修正文档漂移、建立质量门禁、产出可进入 Phase 1 的统一输入
> 关联总纲：[`IMPLEMENTATION_EXECUTION_ROADMAP.md`](./IMPLEMENTATION_EXECUTION_ROADMAP.md)

## 1. Phase 0 Definition of Done

Phase 0 只有在以下条件全部满足时才算完成：

1. 执行文档、README、接口说明与当前代码入口一致，不再出现 `server.js/index.js` 的旧描述。
2. 后端测试覆盖统计不再指向失效的 `src/**/*.js` 路径。
3. 前端具备最小可运行测试骨架，至少包含 1 条冒烟链路。
4. CI 不再只有 Docker Build，至少新增 `lint/typecheck/test/security-scan` 入口。
5. 关键漂移项完成结论归档：Relay/Redis、会话模型、Observability API、端口拓扑、覆盖率基线。
6. 形成一份 `Phase 0 基线评估报告`，包含性能、质量、业务、发布四类基线。

## 2. 执行边界

### In Scope

- 文档基线修正
- 测试/扫描/CI 门禁骨架
- API 与路由漂移清点
- 端口与部署拓扑清点
- 指标基线采集方案

### Out of Scope

- 大规模功能重构
- 大面积 UI 改版
- Relay 对 Redis 的正式切流
- 商业化功能上线
- 覆盖率直接抬到全仓库 90%

## 3. 当前基线问题状态

| ID | 状态 | 问题 | 代码证据 | 影响 |
|---|---|---|---|---|
| B-01 | 已完成 | 根 README 已对齐到 `index.ts/server.ts` 真实入口 | [`README.md`](/home/maple/.openclaw/projects/mapleclaw/README.md) | 文档漂移已收敛 |
| B-02 | 已完成 | Jest 覆盖路径已修正，当前按模块级统计 `skills`、`observability`、`email` 路由 | [`jest.config.js`](/home/maple/.openclaw/projects/mapleclaw/chat-hub/tests/jest.config.js) | 覆盖率不再恒为 0，CI 门禁可用 |
| B-03 | 进行中 | Relay 默认端口与容器端口冲突 | [`server.ts`](/home/maple/.openclaw/projects/mapleclaw/chat-hub/src/server.ts:2065), [`docker-compose.yml`](/home/maple/.openclaw/projects/mapleclaw/docker-compose.yml:36) | 本地与容器语义冲突，影响切流与排障 |
| B-04 | 进行中 | Redis 仍是主通知链路，Relay 只是可选旁路 | [`server.ts`](/home/maple/.openclaw/projects/mapleclaw/chat-hub/src/server.ts:2072), [`server.ts`](/home/maple/.openclaw/projects/mapleclaw/chat-hub/src/server.ts:305) | 不能直接宣称“已完成 Relay 替代 Redis” |
| B-05 | 已完成 | Observability 前后端契约已补齐 `/system` | [`observability.js`](/home/maple/.openclaw/projects/mapleclaw/chat-web/src/api/observability.js), [`observability.ts`](/home/maple/.openclaw/projects/mapleclaw/chat-hub/src/routes/observability.ts) | 契约漂移已收敛 |
| B-06 | 已完成 | Observability 路由注释已改为 `server.ts` | [`observability.ts`](/home/maple/.openclaw/projects/mapleclaw/chat-hub/src/routes/observability.ts:7) | 再次文档漂移风险下降 |
| B-07 | 已完成 | 前端已具备测试脚本与最小冒烟链路 | [`chat-web/package.json`](/home/maple/.openclaw/projects/mapleclaw/chat-web/package.json), [`Home.test.js`](/home/maple/.openclaw/projects/mapleclaw/chat-web/src/views/Home.test.js) | 已建立 UI 回归门禁骨架 |
| B-08 | 待处理 | 仓库未见 Sonar/ZAP/Lighthouse 等配置 | 本地扫描结果 | 安全与性能目标无承载面 |

## 4. 任务拆解

### 工作流 A：文档与架构对齐

| 任务 | Owner | 工时 | 依赖 | 主要文件 | 产出 |
|---|---|---:|---|---|---|
| P0-A1 清点全部过期文档描述 | 小琳 | 0.5d | 无 | `README.md`, `chat-hub/docs/*.md` | 漂移问题清单 |
| P0-A2 修正 README 入口、架构、启动方式 | 小猪 | 1d | P0-A1 | `README.md` | README vNext |
| P0-A3 输出系统上下文图与执行边界 | 小琳 | 0.5d | P0-A1 | `chat-hub/docs/` | 架构蓝图补充页 |
| P0-A4 明确 Relay/Redis、Session 双域、Observability 契约 | 小琳 | 1d | P0-A3 | `chat-hub/docs/` | 统一术语与边界说明 |

验收：

- 文档不再出现已过期入口或路由说明。
- 新人按 README 可找到真实服务入口与 V2 路由。

### 工作流 B：测试与质量门禁

| 任务 | Owner | 工时 | 依赖 | 主要文件 | 产出 |
|---|---|---:|---|---|---|
| P0-B1 修正后端 Jest 覆盖范围与阈值策略 | 小猪 | 1d | 无 | `chat-hub/tests/jest.config.js` | 可用覆盖率统计 |
| P0-B2 建立后端 `lint/typecheck/test` CI Job | 小琳 | 1d | P0-B1 | `.github/workflows/` | 基础质量流水线 |
| P0-B3 为前端补最小测试框架 | 前端/小猪 | 1.5d | 无 | `chat-web/package.json`, `chat-web/` | 前端测试骨架 |
| P0-B4 建立 Playwright 冒烟链路 | QA | 1d | P0-B3 | `chat-web/`, `tests/` | 关键页面冒烟测试 |
| P0-B5 接入依赖漏洞扫描与 SCA | 小琳 | 0.5d | P0-B2 | `.github/workflows/` | 依赖风险报告 |

验收：

- PR 可自动执行 `typecheck + unit test + smoke test`。
- 后端覆盖率结果与真实源码目录一致。
- 前端至少能跑 1 条登录或主页冒烟。

### 工作流 C：接口与拓扑基线

| 任务 | Owner | 工时 | 依赖 | 主要文件 | 产出 |
|---|---|---:|---|---|---|
| P0-C1 盘点对外 API 面与兼容矩阵 | 小琳 | 1d | 无 | `chat-hub/src/routes/`, `chat-hub/docs/API.md` | API 矩阵 |
| P0-C2 修复 Observability API 漂移 | 小猪 | 0.5d | P0-C1 | `chat-web/src/api/observability.js`, `chat-hub/src/routes/observability.ts` | 契约一致 |
| P0-C3 梳理端口与部署拓扑 | 小琳/SRE | 0.5d | 无 | `docker-compose.yml`, `chat-hub/src/server.ts` | 端口规划说明 |
| P0-C4 明确 Relay 与 Redis 的阶段性关系 | 小琳 | 0.5d | P0-C3 | `chat-hub/docs/` | 切流策略说明 |

验收：

- 有一份单页矩阵明确 `/api/*`、`/api/v1/*`、未来 `/v1/*` 的关系。
- 端口不再存在“一个端口两种语义”的文档歧义。

### 工作流 D：基线采集与验收模板

| 任务 | Owner | 工时 | 依赖 | 主要文件 | 产出 |
|---|---|---:|---|---|---|
| P0-D1 建立质量基线模板 | QA | 0.5d | 无 | `chat-hub/docs/` | 质量基线模板 |
| P0-D2 建立性能基线模板 | SRE | 0.5d | 无 | `chat-hub/docs/` | 压测基线模板 |
| P0-D3 建立业务指标基线模板 | 鸿枫 | 0.5d | 无 | `chat-hub/docs/` | 北极星与漏斗基线 |
| P0-D4 汇总 Phase 0 评估报告 | 小琳 | 1d | A/B/C/D 全部 | `chat-hub/docs/` | 基线评估报告 |

验收：

- 输出统一模板，不再口头承诺指标。
- Phase 1 所有目标均有“当前值、目标值、测量方法”。

## 5. 建议排期

### Week 1

| 日期 | 任务 |
|---|---|
| 03-09 | P0-A1, P0-C1 |
| 03-10 | P0-A2 |
| 03-11 | P0-A3, P0-C3 |
| 03-12 | P0-B1, P0-B2 |
| 03-13 | P0-B3 |

### Week 2

| 日期 | 任务 |
|---|---|
| 03-16 | P0-B4, P0-C2 |
| 03-17 | P0-C4, P0-D1 |
| 03-18 | P0-D2, P0-D3 |
| 03-19 | P0-A4 |
| 03-20 | P0-D4, Phase 0 Gate Review |

## 6. Phase 0 Gate Review

评审参与人：

- 鸿枫：确认 PRD 范围、里程碑、业务指标口径
- 小琳：确认架构边界、质量门禁、Phase 1 进入条件
- 小猪：确认当前实现差距与落地工期
- QA/SRE/设计：确认支持资源与阻塞项

Gate Review 必答题：

1. 当前 README 是否已能准确指导新成员启动和定位代码入口？
2. 覆盖率是否可真实反映后端现状？
3. 前端是否已有最小自动化回归能力？
4. Relay 和 Redis 的职责是否已写清楚？
5. 端口规划是否已避免 `8274` 冲突？
6. Observability 契约是否前后端一致？
7. Phase 1 的所有目标是否都有基线值？

## 7. Phase 1 进入条件

只有满足以下条件才能进入 Phase 1：

- `README.md`、API 文档、执行路线图已更新完成
- 至少 1 条前端冒烟、1 条后端单测、1 条 API 测试进入 CI
- 后端覆盖统计已修正
- 已形成端口规划与 Relay/Redis 切流说明
- 已形成基线评估报告并在评审会上过会

## 8. 风险清单

| 风险 | 概率 | 影响 | 预案 |
|---|---:|---:|---|
| 用户继续直接改 `server.ts` 等核心文件 | 高 | 高 | 进入执行期后先冻结基线并约束合入 |
| 前端测试框架接入成本超预期 | 中 | 中 | 先以 Playwright 页面级冒烟兜底，再补单测 |
| 质量门禁触发大量历史问题 | 高 | 中 | 先建立 baseline，使用 new-code gate 而非一次性清仓 |
| Relay/Redis 切流口径未统一 | 中 | 高 | Phase 0 只出策略，不做切流 |
| 设计/QA/SRE 资源不到位 | 高 | 高 | 排期从 13 周切换到 18-20 周保守模式 |

## 9. 建议直接创建的任务卡

建议在任务系统中立即创建以下卡片：

1. `P0-A2 README 与架构文档纠偏`
2. `P0-B1 Jest 覆盖率配置修正`
3. `P0-B3 chat-web 最小测试骨架接入`
4. `P0-C2 Observability API 契约修正`
5. `P0-C3 Relay/Redis/端口拓扑基线梳理`
6. `P0-D4 Phase 0 基线评估报告`

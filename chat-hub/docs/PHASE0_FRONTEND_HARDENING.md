# Phase 0 前端加固记录

> 更新时间：2026-03-08
> 范围：`chat-web`

## 本轮完成

1. 新增 `vitest` 最小测试骨架，并落地 2 类冒烟：
   - 1 条 Observability API 契约冒烟
   - 1 条首页入口流 UI 冒烟
2. 升级前端依赖：
   - `axios` `1.13.4 -> 1.13.6`
   - `dompurify` `3.3.1 -> 3.3.2`
   - `@vitejs/plugin-vue` `6.0.1 -> 6.0.4`
   - `vite` `7.2.4 -> 7.3.1`
3. 将图表引用从全量 `echarts` 切换为 `echarts/core` 按需注册。
4. 为图表组件补充 `resize` 和 `dispose` 生命周期处理，降低页面切换后的实例残留风险。
5. 在 CI 中新增 `chat-web npm audit --audit-level=high`。

## 验证结果

| 项目 | 结果 |
|---|---|
| `npm test` | 通过 |
| `npm audit` | 0 漏洞 |
| `npm run build` | 通过 |

## Bundle 变化

| 指标 | 调整前 | 调整后 | 变化 |
|---|---:|---:|---:|
| `vendor-echarts` | `1119.76 kB` | `526.60 kB` | `-52.97%` |

## 剩余问题

1. `vendor-echarts` 已降到预警阈值以下，但仍是当前前端最大 chunk，后续可以继续把统计页和资源监控做异步组件级拆分。
2. 后端 `chat-hub` 仍存在较多依赖安全债，当前不适合直接纳入阻断式 audit gate。

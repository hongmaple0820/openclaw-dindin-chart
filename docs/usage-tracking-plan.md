# 使用追踪方案 (Usage Tracking Plan)

> 如何了解开源项目的使用情况

## 📊 追踪方案

### 方案 1：匿名统计（已实现）

**原理**：软件启动时发送匿名统计到服务器

**收集信息**：
- 安装 ID（随机生成）
- 软件版本
- 操作系统
- 启动次数
- 活跃天数

**不收集**：
- IP 地址
- 用户身份
- 业务数据

**实现**：`chat-hub/src/analytics.js`

**用户可禁用**：
```json
{
  "analytics": {
    "enabled": false
  }
}
```

### 方案 2：统计后端

部署一个简单的统计收集服务：

```javascript
// analytics-server.js
const express = require('express');
const app = express();

app.use(express.json());

const stats = {
  installs: new Set(),
  dailyActive: new Map(),
  versions: new Map(),
  platforms: new Map()
};

app.post('/v1/collect', (req, res) => {
  const { event, installId, version, os } = req.body;
  
  if (event === 'startup') {
    stats.installs.add(installId);
    stats.versions.set(version, (stats.versions.get(version) || 0) + 1);
    if (os?.platform) {
      stats.platforms.set(os.platform, (stats.platforms.get(os.platform) || 0) + 1);
    }
  }
  
  if (event === 'daily_active') {
    const today = new Date().toISOString().split('T')[0];
    if (!stats.dailyActive.has(today)) {
      stats.dailyActive.set(today, new Set());
    }
    stats.dailyActive.get(today).add(installId);
  }
  
  res.json({ ok: true });
});

app.get('/v1/stats', (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  res.json({
    totalInstalls: stats.installs.size,
    todayActive: stats.dailyActive.get(today)?.size || 0,
    versions: Object.fromEntries(stats.versions),
    platforms: Object.fromEntries(stats.platforms)
  });
});

app.listen(3100, () => console.log('Analytics server on :3100'));
```

### 方案 3：GitHub/Gitee 数据

利用平台提供的数据：

| 指标 | 来源 | 说明 |
|------|------|------|
| Star 数 | Gitee/GitHub | 受欢迎程度 |
| Fork 数 | Gitee/GitHub | 有多少人在用 |
| Clone 数 | Gitee Insights | 下载次数 |
| 访问量 | Gitee Insights | 页面浏览量 |
| Issue 数 | Gitee/GitHub | 活跃用户 |

**Gitee Insights**：
- 项目 → 统计 → 可以看到访问量、Clone 数

### 方案 4：注册制

要求用户注册后才能使用高级功能：

```javascript
// 检查许可证
async function checkLicense(key) {
  const res = await fetch('https://license.example.com/verify', {
    method: 'POST',
    body: JSON.stringify({ key })
  });
  return res.json();
}

// 启动时检查
if (config.license?.key) {
  const result = await checkLicense(config.license.key);
  if (!result.valid) {
    console.log('⚠️ 许可证无效，部分功能受限');
  }
}
```

### 方案 5：社区追踪

- **用户群**：建立钉钉/微信用户群
- **问卷调查**：定期收集用户反馈
- **案例收集**：邀请用户分享使用场景

---

## 🎯 推荐方案

### 初期（0-100 用户）

1. ✅ 匿名统计（已实现）
2. ✅ Gitee Insights 观察
3. ✅ Issue 互动

### 中期（100-1000 用户）

1. 部署统计后端
2. 建立用户社群
3. 收集使用案例

### 规模期（1000+ 用户）

1. 完善许可证验证
2. 商业用户追踪
3. 定期用户调研

---

## 📋 待办事项

- [ ] 部署统计后端
- [ ] 配置 analytics.endpoint 指向你的服务器
- [ ] 在 Gitee 启用 Insights
- [ ] 建立用户交流群
- [ ] 设计许可证验证 API

---

## 🔐 隐私合规

1. **透明告知**：在 README 和启动日志中说明统计功能
2. **可选退出**：用户可以在配置中禁用
3. **最小收集**：只收集必要的匿名信息
4. **数据安全**：统计数据不含敏感信息

---

*文档版本：1.0*
*更新日期：2026-02-06*

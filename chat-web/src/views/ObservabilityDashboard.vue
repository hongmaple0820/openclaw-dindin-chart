<!--
  可观测性仪表板
  @author 小琳
  @date 2026-03-04
  功能：日志、指标、系统状态可视化
-->
<template>
  <div class="observability-dashboard">
    <div class="page-header">
      <h2>📊 可观测性仪表板</h2>
      <div class="header-actions">
        <el-select v-model="timeRange" placeholder="时间范围" style="width: 120px" @change="loadAll">
          <el-option label="最近1小时" value="1h" />
          <el-option label="最近6小时" value="6h" />
          <el-option label="最近24小时" value="24h" />
          <el-option label="最近7天" value="7d" />
        </el-select>
        <el-button @click="loadAll" :loading="loading">
          <el-icon><Refresh /></el-icon>
          刷新
        </el-button>
      </div>
    </div>

    <!-- 概览卡片 -->
    <div class="summary-cards">
      <div class="summary-card card-logs">
        <div class="card-icon">📝</div>
        <div class="card-body">
          <div class="card-value">{{ summary.totalLogs || 0 }}</div>
          <div class="card-label">总日志数</div>
        </div>
      </div>
      <div class="summary-card card-metrics">
        <div class="card-icon">📈</div>
        <div class="card-body">
          <div class="card-value">{{ summary.totalMetrics || 0 }}</div>
          <div class="card-label">指标数</div>
        </div>
      </div>
      <div class="summary-card card-errors" :class="{ 'has-errors': summary.errorCount > 0 }">
        <div class="card-icon">⚠️</div>
        <div class="card-body">
          <div class="card-value">{{ summary.errorCount || 0 }}</div>
          <div class="card-label">错误数</div>
        </div>
      </div>
      <div class="summary-card card-health">
        <div class="card-icon">💚</div>
        <div class="card-body">
          <div class="card-value">{{ healthStatus }}</div>
          <div class="card-label">健康状态</div>
        </div>
      </div>
    </div>

    <!-- 日志级别分布 -->
    <div class="section-row">
      <el-card class="section-card">
        <template #header>
          <div class="section-title">
            <span>日志级别分布</span>
          </div>
        </template>
        <div class="level-chart">
          <div v-for="item in logsByLevel" :key="item.level" class="level-bar-wrapper">
            <div class="level-label">{{ item.level }}</div>
            <div class="level-bar-container">
              <div 
                class="level-bar" 
                :class="item.level"
                :style="{ width: getLevelPercent(item.count) + '%' }"
              ></div>
            </div>
            <div class="level-count">{{ item.count }}</div>
          </div>
          <div v-if="logsByLevel.length === 0" class="no-data">暂无数据</div>
        </div>
      </el-card>

      <!-- 热门端点 -->
      <el-card class="section-card">
        <template #header>
          <div class="section-title">
            <span>热门 API 端点</span>
          </div>
        </template>
        <div class="endpoints-list">
          <div v-for="(ep, index) in topEndpoints" :key="ep.endpoint" class="endpoint-item">
            <span class="endpoint-rank">{{ index + 1 }}</span>
            <span class="endpoint-path">{{ ep.endpoint }}</span>
            <span class="endpoint-count">{{ ep.count }} 次</span>
          </div>
          <div v-if="topEndpoints.length === 0" class="no-data">暂无数据</div>
        </div>
      </el-card>
    </div>

    <!-- 响应时间 -->
    <el-card class="section-card full-width">
      <template #header>
        <div class="section-title">
          <span>API 响应时间</span>
          <el-tag size="small" type="info">单位: ms</el-tag>
        </div>
      </template>
      <div class="response-times">
        <el-table :data="responseTimeData" stripe style="width: 100%">
          <el-table-column prop="endpoint" label="端点" min-width="200" />
          <el-table-column prop="count" label="请求次数" width="100" />
          <el-table-column prop="avg" label="平均响应" width="100">
            <template #default="{ row }">
              <el-tag :type="getResponseTagType(row.avg)">{{ row.avg }}ms</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="min" label="最小" width="80" />
          <el-table-column prop="max" label="最大" width="80" />
        </el-table>
        <div v-if="responseTimeData.length === 0" class="no-data">暂无数据</div>
      </div>
    </el-card>

    <!-- 最近日志 -->
    <el-card class="section-card full-width">
      <template #header>
        <div class="section-title">
          <span>最近日志</span>
          <el-select v-model="logLevel" placeholder="日志级别" size="small" style="width: 100px" @change="loadLogs">
            <el-option label="全部" value="" />
            <el-option label="error" value="error" />
            <el-option label="warn" value="warn" />
            <el-option label="info" value="info" />
            <el-option label="debug" value="debug" />
          </el-select>
        </div>
      </template>
      <div class="logs-container">
        <div v-for="log in recentLogs" :key="log.timestamp" class="log-item" :class="log.level">
          <span class="log-time">{{ formatTime(log.timestamp) }}</span>
          <span class="log-level" :class="log.level">{{ log.level?.toUpperCase() }}</span>
          <span class="log-message">{{ log.message }}</span>
        </div>
        <div v-if="recentLogs.length === 0" class="no-data">暂无日志</div>
      </div>
    </el-card>

    <!-- 最近指标 -->
    <el-card class="section-card full-width">
      <template #header>
        <div class="section-title">
          <span>最近指标</span>
        </div>
      </template>
      <div class="metrics-container">
        <div v-for="metric in recentMetrics" :key="metric.timestamp + metric.name" class="metric-item">
          <span class="metric-time">{{ formatTime(metric.timestamp) }}</span>
          <span class="metric-name">{{ metric.name }}</span>
          <span class="metric-value">{{ metric.value }}</span>
          <span v-if="metric.tags" class="metric-tags">{{ formatTags(metric.tags) }}</span>
        </div>
        <div v-if="recentMetrics.length === 0" class="no-data">暂无指标</div>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { ElMessage } from 'element-plus';
import { Refresh } from '@element-plus/icons-vue';
import observabilityApi from '@/api/observability';

const loading = ref(false);
const timeRange = ref('24h');
const logLevel = ref('');

const summary = ref({});
const logsByLevel = ref([]);
const topEndpoints = ref([]);
const responseTimeData = ref([]);
const recentLogs = ref([]);
const recentMetrics = ref([]);
const healthStatus = ref('healthy');

const maxLevelCount = computed(() => {
  return Math.max(...logsByLevel.value.map(l => l.count), 1);
});

function getLevelPercent(count) {
  return (count / maxLevelCount.value) * 100;
}

function getResponseTagType(avg) {
  if (avg < 100) return 'success';
  if (avg < 500) return 'warning';
  return 'danger';
}

function formatTime(timestamp) {
  if (!timestamp) return '';
  return new Date(timestamp).toLocaleString('zh-CN');
}

function formatTags(tags) {
  if (!tags) return '';
  return Object.entries(tags).map(([k, v]) => `${k}=${v}`).join(', ');
}

async function loadAll() {
  loading.value = true;
  try {
    await Promise.all([
      loadDashboard(),
      loadLogs(),
      loadMetrics()
    ]);
  } finally {
    loading.value = false;
  }
}

async function loadDashboard() {
  try {
    const res = await observabilityApi.getDashboard();
    if (res.success) {
      const data = res.data;
      summary.value = data.summary || {};
      logsByLevel.value = data.logsByLevel || [];
      topEndpoints.value = data.topEndpoints || [];
      
      // 处理响应时间数据
      const rt = data.responseTimes || {};
      responseTimeData.value = Object.entries(rt).map(([endpoint, stats]) => ({
        endpoint,
        ...stats
      }));
    }
  } catch (error) {
    console.error('加载仪表板失败:', error);
  }
}

async function loadLogs() {
  try {
    const params = { limit: 50 };
    if (logLevel.value) params.level = logLevel.value;
    
    const res = await observabilityApi.getLogs(params);
    if (res.success) {
      recentLogs.value = res.data || [];
    }
  } catch (error) {
    console.error('加载日志失败:', error);
  }
}

async function loadMetrics() {
  try {
    const res = await observabilityApi.getMetrics({ limit: 30 });
    if (res.success) {
      recentMetrics.value = res.data || [];
    }
  } catch (error) {
    console.error('加载指标失败:', error);
  }
}

async function checkHealth() {
  try {
    const res = await observabilityApi.checkHealth();
    healthStatus.value = res.success ? 'healthy' : 'unhealthy';
  } catch (error) {
    healthStatus.value = 'error';
  }
}

let refreshInterval = null;

onMounted(() => {
  loadAll();
  checkHealth();
  // 每30秒自动刷新
  refreshInterval = setInterval(loadAll, 30000);
});

onUnmounted(() => {
  if (refreshInterval) clearInterval(refreshInterval);
});
</script>

<style scoped>
.observability-dashboard { padding: 20px; max-width: 1400px; margin: 0 auto; }

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.page-header h2 { margin: 0; font-size: 24px; color: #303133; }

.header-actions { display: flex; gap: 12px; }

/* 概览卡片 */
.summary-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.summary-card {
  background: #fff;
  border-radius: 12px;
  padding: 20px;
  display: flex;
  align-items: center;
  gap: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.summary-card.card-errors.has-errors {
  border: 1px solid #f56c6c;
  background: #fef0f0;
}

.card-icon { font-size: 36px; }

.card-value { font-size: 28px; font-weight: bold; color: #303133; }
.card-label { font-size: 13px; color: #909399; }

/* 区域 */
.section-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: 16px;
  margin-bottom: 16px;
}

.section-card {
  margin-bottom: 16px;
}

.section-card.full-width {
  grid-column: 1 / -1;
}

.section-title {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

/* 日志级别 */
.level-chart {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.level-bar-wrapper {
  display: flex;
  align-items: center;
  gap: 12px;
}

.level-label {
  width: 50px;
  font-size: 13px;
  font-weight: 500;
  text-transform: uppercase;
}

.level-bar-container {
  flex: 1;
  height: 24px;
  background: #f5f7fa;
  border-radius: 4px;
  overflow: hidden;
}

.level-bar {
  height: 100%;
  border-radius: 4px;
  transition: width 0.5s ease;
}

.level-bar.error { background: linear-gradient(90deg, #f56c6c, #fab6b6); }
.level-bar.warn { background: linear-gradient(90deg, #e6a23c, #f3d19e); }
.level-bar.info { background: linear-gradient(90deg, #409eff, #a0cfff); }
.level-bar.debug { background: linear-gradient(90deg, #909399, #c0c4cc); }

.level-count {
  width: 50px;
  text-align: right;
  font-size: 13px;
  color: #606266;
}

/* 端点列表 */
.endpoints-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.endpoint-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  background: #f5f7fa;
  border-radius: 6px;
}

.endpoint-rank {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: #409eff;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: bold;
}

.endpoint-path { flex: 1; font-family: monospace; font-size: 13px; }
.endpoint-count { font-size: 13px; color: #909399; }

/* 响应时间 */
.response-times { min-height: 200px; }

/* 日志 */
.logs-container {
  max-height: 400px;
  overflow-y: auto;
  font-family: 'JetBrains Mono', 'Consolas', monospace;
  font-size: 12px;
}

.log-item {
  display: flex;
  gap: 12px;
  padding: 8px 12px;
  border-bottom: 1px solid #f0f0f0;
}

.log-item:hover { background: #f5f7fa; }

.log-item.error { background: #fef0f0; }
.log-item.warn { background: #fdf6ec; }

.log-time { color: #909399; white-space: nowrap; }

.log-level {
  font-weight: bold;
  text-transform: uppercase;
  min-width: 50px;
}

.log-level.error { color: #f56c6c; }
.log-level.warn { color: #e6a23c; }
.log-level.info { color: #409eff; }
.log-level.debug { color: #909399; }

.log-message { flex: 1; color: #606266; word-break: break-all; }

/* 指标 */
.metrics-container {
  max-height: 300px;
  overflow-y: auto;
}

.metric-item {
  display: flex;
  gap: 12px;
  padding: 8px 12px;
  border-bottom: 1px solid #f0f0f0;
  font-family: monospace;
  font-size: 13px;
}

.metric-time { color: #909399; white-space: nowrap; }
.metric-name { font-weight: 500; color: #409eff; }
.metric-value { color: #67c23a; font-weight: bold; }
.metric-tags { color: #909399; font-size: 12px; }

.no-data {
  text-align: center;
  color: #909399;
  padding: 40px;
}

@media (max-width: 768px) {
  .observability-dashboard { padding: 12px; }
  .page-header { flex-direction: column; align-items: flex-start; gap: 12px; }
  .section-row { grid-template-columns: 1fr; }
  .summary-cards { grid-template-columns: repeat(2, 1fr); }
}
</style>
<template>
  <div class="stats">
    <h1>📈 数据统计</h1>
    
    <!-- 时间趋势图 -->
    <div class="chart-section">
      <h2>消息趋势</h2>
      <div class="chart-controls">
        <select v-model="timeRange" @change="loadTimeStats">
          <option value="7">近 7 天</option>
          <option value="14">近 14 天</option>
          <option value="30">近 30 天</option>
        </select>
      </div>
      <div ref="timeChart" class="chart"></div>
    </div>

    <!-- 发送者分布 -->
    <div class="stats-row">
      <div class="chart-section half">
        <h2>发送者统计</h2>
        <div ref="senderChart" class="chart"></div>
      </div>
      
      <div class="chart-section half">
        <h2>来源分布</h2>
        <div ref="sourceChart" class="chart"></div>
      </div>
    </div>

    <!-- 详细数据表 -->
    <div class="data-section">
      <h2>发送者详情</h2>
      <table>
        <thead>
          <tr>
            <th>发送者</th>
            <th>类型</th>
            <th>消息数</th>
            <th>占比</th>
            <th>首条消息</th>
            <th>最后消息</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="s in senderStats" :key="s.sender">
            <td>{{ s.sender }}</td>
            <td>{{ s.type === 'human' ? '👤' : '🤖' }}</td>
            <td>{{ s.count }}</td>
            <td>{{ ((s.count / totalMessages) * 100).toFixed(1) }}%</td>
            <td>{{ formatTime(s.firstMessage) }}</td>
            <td>{{ formatTime(s.lastMessage) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import { echarts, graphic } from '@/utils/echarts'
import api from '../api'

const timeRange = ref('7')
const senderStats = ref([])
const totalMessages = ref(0)

const timeChart = ref(null)
const senderChart = ref(null)
const sourceChart = ref(null)

let timeChartInstance = null
let senderChartInstance = null
let sourceChartInstance = null
let resizeHandler = null

const formatTime = (ts) => {
  if (!ts) return '-'
  return new Date(ts).toLocaleDateString('zh-CN')
}

const loadTimeStats = async () => {
  try {
    const res = await api.getStatsByTime({ interval: 'day', days: timeRange.value })
    const data = res.data.data
    
    if (!timeChartInstance) {
      timeChartInstance = echarts.init(timeChart.value)
    }
    
    timeChartInstance.setOption({
      tooltip: { trigger: 'axis' },
      xAxis: {
        type: 'category',
        data: data.map(d => d.time)
      },
      yAxis: { type: 'value' },
      series: [{
        name: '消息数',
        type: 'line',
        smooth: true,
        data: data.map(d => d.count),
        areaStyle: {
          color: new graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(25, 118, 210, 0.5)' },
            { offset: 1, color: 'rgba(25, 118, 210, 0.1)' }
          ])
        },
        lineStyle: { color: '#1976d2' },
        itemStyle: { color: '#1976d2' }
      }]
    })
  } catch (error) {
    console.error('加载时间统计失败:', error)
  }
}

const loadSenderStats = async () => {
  try {
    const res = await api.getStatsBySender()
    senderStats.value = res.data.data
    totalMessages.value = senderStats.value.reduce((sum, s) => sum + s.count, 0)
    
    if (!senderChartInstance) {
      senderChartInstance = echarts.init(senderChart.value)
    }
    
    senderChartInstance.setOption({
      tooltip: { trigger: 'item' },
      series: [{
        type: 'pie',
        radius: ['40%', '70%'],
        data: senderStats.value.map(s => ({
          name: s.sender,
          value: s.count
        })),
        label: {
          formatter: '{b}: {c}'
        }
      }]
    })
  } catch (error) {
    console.error('加载发送者统计失败:', error)
  }
}

const loadSourceStats = async () => {
  try {
    const res = await api.getStatsBySource()
    const data = res.data.data
    
    if (!sourceChartInstance) {
      sourceChartInstance = echarts.init(sourceChart.value)
    }
    
    const sourceNames = {
      'dingtalk': '钉钉',
      'web': 'Web',
      'bot': '机器人',
      'redis': 'Redis',
      'null': '未知'
    }
    
    sourceChartInstance.setOption({
      tooltip: { trigger: 'item' },
      series: [{
        type: 'pie',
        radius: '70%',
        data: data.map(s => ({
          name: sourceNames[s.source] || s.source || '未知',
          value: s.count
        }))
      }]
    })
  } catch (error) {
    console.error('加载来源统计失败:', error)
  }
}

onMounted(async () => {
  await nextTick()
  loadTimeStats()
  loadSenderStats()
  loadSourceStats()
  resizeHandler = () => {
    timeChartInstance?.resize()
    senderChartInstance?.resize()
    sourceChartInstance?.resize()
  }
  window.addEventListener('resize', resizeHandler)
})

onUnmounted(() => {
  window.removeEventListener('resize', resizeHandler)
  timeChartInstance?.dispose()
  senderChartInstance?.dispose()
  sourceChartInstance?.dispose()
})
</script>

<style scoped>
.stats {
  padding: 20px;
}

h1 {
  margin-bottom: 20px;
}

h2 {
  margin-bottom: 15px;
  font-size: 18px;
}

.chart-section {
  background: white;
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 20px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.chart-controls {
  margin-bottom: 15px;
}

.chart-controls select {
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
}

.chart {
  height: 300px;
}

.stats-row {
  display: flex;
  gap: 20px;
}

.half {
  flex: 1;
}

.data-section {
  background: white;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

table {
  width: 100%;
  border-collapse: collapse;
}

th, td {
  padding: 12px;
  text-align: left;
  border-bottom: 1px solid #eee;
}

th {
  background: #f5f5f5;
  font-weight: 600;
}

@media (max-width: 768px) {
  .stats-row {
    flex-direction: column;
  }
}
</style>

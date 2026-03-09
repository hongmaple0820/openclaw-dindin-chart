<!--
  资源监控图表组件
  @author 小琳
  @date 2026-03-04
-->
<template>
  <div class="resource-monitor">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>资源监控</span>
          <el-select v-model="period" size="small" style="width: 100px;" @change="handlePeriodChange">
            <el-option label="1小时" value="1h" />
            <el-option label="6小时" value="6h" />
            <el-option label="24小时" value="24h" />
            <el-option label="7天" value="7d" />
          </el-select>
        </div>
      </template>

      <div class="monitor-content">
        <!-- CPU 使用率 -->
        <div class="monitor-item">
          <div class="monitor-label">CPU 使用率</div>
          <div class="monitor-chart" ref="cpuChartRef"></div>
          <div class="monitor-value">{{ currentCpu }}%</div>
        </div>

        <!-- 内存使用 -->
        <div class="monitor-item">
          <div class="monitor-label">内存使用</div>
          <div class="monitor-chart" ref="memoryChartRef"></div>
          <div class="monitor-value">{{ currentMemory }} MB</div>
        </div>

        <!-- 磁盘使用 -->
        <div class="monitor-item">
          <div class="monitor-label">磁盘使用</div>
          <div class="monitor-chart" ref="diskChartRef"></div>
          <div class="monitor-value">{{ currentDisk }} GB</div>
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue';
import { echarts } from '@/utils/echarts';

const props = defineProps({
  data: {
    type: Object,
    default: () => ({
      cpu: [],
      memory: [],
      disk: []
    })
  }
});

const emit = defineEmits(['period-change']);

const period = ref('1h');
const cpuChartRef = ref();
const memoryChartRef = ref();
const diskChartRef = ref();
const currentCpu = ref(0);
const currentMemory = ref(0);
const currentDisk = ref(0);

let cpuChart = null;
let memoryChart = null;
let diskChart = null;
let resizeHandler = null;

onMounted(() => {
  initCharts();
  updateCharts();
  resizeHandler = () => {
    cpuChart?.resize();
    memoryChart?.resize();
    diskChart?.resize();
  };
  window.addEventListener('resize', resizeHandler);
});

onUnmounted(() => {
  window.removeEventListener('resize', resizeHandler);
  cpuChart?.dispose();
  memoryChart?.dispose();
  diskChart?.dispose();
});

watch(() => props.data, () => {
  updateCharts();
}, { deep: true });

function initCharts() {
  if (cpuChartRef.value) {
    cpuChart = echarts.init(cpuChartRef.value);
  }
  if (memoryChartRef.value) {
    memoryChart = echarts.init(memoryChartRef.value);
  }
  if (diskChartRef.value) {
    diskChart = echarts.init(diskChartRef.value);
  }
}

function updateCharts() {
  const option = {
    grid: { top: 10, right: 10, bottom: 20, left: 40 },
    xAxis: {
      type: 'category',
      data: props.data.cpu?.map((_, i) => i) || []
    },
    yAxis: {
      type: 'value',
      max: 100
    },
    series: [{
      data: props.data.cpu || [],
      type: 'line',
      smooth: true,
      areaStyle: {}
    }]
  };

  if (cpuChart) {
    cpuChart.setOption(option);
    currentCpu.value = props.data.cpu?.[props.data.cpu.length - 1] || 0;
  }

  if (memoryChart) {
    memoryChart.setOption({
      ...option,
      series: [{ ...option.series[0], data: props.data.memory || [] }]
    });
    currentMemory.value = props.data.memory?.[props.data.memory.length - 1] || 0;
  }

  if (diskChart) {
    diskChart.setOption({
      ...option,
      series: [{ ...option.series[0], data: props.data.disk || [] }]
    });
    currentDisk.value = props.data.disk?.[props.data.disk.length - 1] || 0;
  }
}

function handlePeriodChange() {
  emit('period-change', period.value);
}
</script>

<style scoped>
.resource-monitor {
  height: 100%;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.monitor-content {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 20px;
}

.monitor-item {
  display: flex;
  flex-direction: column;
}

.monitor-label {
  font-size: 14px;
  color: #606266;
  margin-bottom: 8px;
}

.monitor-chart {
  height: 150px;
  margin-bottom: 8px;
}

.monitor-value {
  font-size: 20px;
  font-weight: bold;
  color: #409eff;
  text-align: center;
}
</style>

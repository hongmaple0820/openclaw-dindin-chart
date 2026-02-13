<template>
  <div v-if="visible" class="feature-tip" :class="type">
    <div class="tip-icon">
      <el-icon><WarningFilled /></el-icon>
    </div>
    <div class="tip-content">
      <div class="tip-title">{{ title }}</div>
      <div class="tip-message">{{ message }}</div>
      <div v-if="showAction" class="tip-action">
        <el-button size="small" type="primary" @click="goToConfig">
          {{ actionText }}
        </el-button>
      </div>
    </div>
    <div v-if="closable" class="tip-close" @click="close">
      <el-icon><Close /></el-icon>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { WarningFilled, Close } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

const props = defineProps({
  feature: {
    type: String,
    default: ''
  },
  type: {
    type: String,
    default: 'warning'
  },
  closable: {
    type: Boolean,
    default: true
  },
  showAction: {
    type: Boolean,
    default: true
  }
})

const router = useRouter()
const configStatus = ref(null)

const title = computed(() => {
  if (props.feature === 'dingtalk') {
    return '钉钉功能受限'
  } else if (props.feature === 'bot') {
    return '机器人功能受限'
  } else if (props.feature === 'sync') {
    return '消息同步功能受限'
  }
  return '功能受限'
})

const message = computed(() => {
  if (!configStatus.value?.webhook?.configured) {
    return '该功能需要配置 webhook 后才能使用。请先配置钉钉 webhook。'
  }
  return '当前功能不可用'
})

const actionText = computed(() => {
  return '配置 webhook'
})

const visible = computed(() => {
  if (!configStatus.value) return false
  return !configStatus.value.webhook?.configured
})

onMounted(async () => {
  await fetchConfigStatus()
})

async function fetchConfigStatus() {
  try {
    const response = await fetch('/api/config/status')
    const data = await response.json()
    configStatus.value = data
  } catch (e) {
    console.error('获取配置状态失败:', e)
  }
}

function goToConfig() {
  ElMessage.info('请运行配置向导：openclaw skill chat-hub-config setup')
}

function close() {
  visible.value = false
}
</script>

<style scoped>
.feature-tip {
  display: flex;
  align-items: flex-start;
  padding: 12px 16px;
  margin: 8px 0;
  border-radius: 4px;
  background-color: #fdf6ec;
  border: 1px solid #f5dab1;
}

.feature-tip.warning {
  background-color: #fdf6ec;
  border-color: #f5dab1;
}

.feature-tip.warning .tip-icon {
  color: #e6a23c;
}

.feature-tip.error {
  background-color: #fef0f0;
  border-color: #fde2e2;
}

.feature-tip.error .tip-icon {
  color: #f56c6c;
}

.feature-tip.info {
  background-color: #f4f4f5;
  border-color: #e9e9eb;
}

.feature-tip.info .tip-icon {
  color: #909399;
}

.tip-icon {
  margin-right: 12px;
  font-size: 18px;
}

.tip-content {
  flex: 1;
}

.tip-title {
  font-weight: 600;
  margin-bottom: 4px;
  color: #303133;
}

.tip-message {
  font-size: 13px;
  color: #606266;
  margin-bottom: 8px;
}

.tip-action {
  margin-top: 8px;
}

.tip-close {
  cursor: pointer;
  color: #909399;
  font-size: 16px;
  margin-left: 8px;
}

.tip-close:hover {
  color: #606266;
}
</style>

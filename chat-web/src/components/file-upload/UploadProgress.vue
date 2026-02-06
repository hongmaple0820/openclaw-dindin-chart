<template>
  <div class="upload-progress-panel">
    <el-collapse v-model="activeNames">
      <el-collapse-item title="上传进度" name="1">
        <div v-if="uploadQueue.length === 0" class="empty-state">
          暂无上传任务
        </div>
        <el-table :data="uploadQueue" style="width: 100%" max-height="400">
          <el-table-column prop="fileName" label="文件名" width="200" show-overflow-tooltip />
          <el-table-column prop="status" label="状态" width="100">
            <template #default="{ row }">
              <el-tag :type="getStatusType(row.status)">
                {{ getStatusText(row.status) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="progress" label="进度" width="150">
            <template #default="{ row }">
              <el-progress 
                :percentage="row.progress" 
                :status="getProgressStatus(row.status)" 
                :show-text="false"
              />
              <span>{{ row.progress }}%</span>
            </template>
          </el-table-column>
          <el-table-column prop="speed" label="速度" width="100">
            <template #default="{ row }">
              {{ formatSpeed(row.speed) }}
            </template>
          </el-table-column>
          <el-table-column label="操作" width="150">
            <template #default="{ row }">
              <el-button 
                v-if="row.status === 'uploading'" 
                type="danger" 
                size="small" 
                @click="cancelUpload(row.id)"
              >
                取消
              </el-button>
              <el-button 
                v-else-if="row.status === 'paused'" 
                type="primary" 
                size="small" 
                @click="resumeUpload(row.id)"
              >
                继续
              </el-button>
              <el-button 
                v-else-if="row.status === 'failed'" 
                type="warning" 
                size="small" 
                @click="retryUpload(row.id)"
              >
                重试
              </el-button>
              <el-button 
                v-else-if="row.status === 'completed'" 
                type="success" 
                size="small" 
                @click="viewFile(row)"
              >
                查看
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-collapse-item>
    </el-collapse>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { ElMessage } from 'element-plus'

// 展开面板
const activeNames = ref(['1'])

// 上传队列
const uploadQueue = reactive([])

/**
 * 添加上传任务
 */
const addUploadTask = (file) => {
  const task = {
    id: Date.now() + Math.random(),
    fileName: file.name,
    fileSize: file.size,
    status: 'pending', // pending, uploading, paused, completed, failed
    progress: 0,
    speed: 0, // bytes/s
    startTime: null,
    endTime: null,
    uploadId: null
  }
  
  uploadQueue.push(task)
  return task.id
}

/**
 * 更新上传进度
 */
const updateProgress = (taskId, progress, speed) => {
  const task = uploadQueue.find(t => t.id === taskId)
  if (task) {
    task.progress = progress
    task.speed = speed
    if (progress === 100) {
      task.status = 'completed'
    }
  }
}

/**
 * 开始上传
 */
const startUpload = (taskId) => {
  const task = uploadQueue.find(t => t.id === taskId)
  if (task) {
    task.status = 'uploading'
    task.startTime = Date.now()
  }
}

/**
 * 暂停上传
 */
const pauseUpload = (taskId) => {
  const task = uploadQueue.find(t => t.id === taskId)
  if (task) {
    task.status = 'paused'
  }
}

/**
 * 取消上传
 */
const cancelUpload = (taskId) => {
  const index = uploadQueue.findIndex(t => t.id === taskId)
  if (index > -1) {
    uploadQueue.splice(index, 1)
    ElMessage.info('已取消上传')
  }
}

/**
 * 重试上传
 */
const retryUpload = (taskId) => {
  const task = uploadQueue.find(t => t.id === taskId)
  if (task) {
    task.status = 'pending'
    task.progress = 0
    task.speed = 0
    // 这里应该重新开始上传逻辑
    ElMessage.info('重试上传')
  }
}

/**
 * 继续上传
 */
const resumeUpload = (taskId) => {
  const task = uploadQueue.find(t => t.id === taskId)
  if (task) {
    task.status = 'uploading'
  }
}

/**
 * 获取状态类型
 */
const getStatusType = (status) => {
  switch (status) {
    case 'completed': return 'success'
    case 'failed': return 'danger'
    case 'paused': return 'warning'
    case 'uploading': return 'primary'
    default: return 'info'
  }
}

/**
 * 获取状态文本
 */
const getStatusText = (status) => {
  switch (status) {
    case 'pending': return '等待中'
    case 'uploading': return '上传中'
    case 'paused': return '已暂停'
    case 'completed': return '已完成'
    case 'failed': return '失败'
    default: return '未知'
  }
}

/**
 * 获取进度条状态
 */
const getProgressStatus = (status) => {
  if (status === 'failed') return 'exception'
  if (status === 'completed') return 'success'
  return undefined
}

/**
 * 格式化速度
 */
const formatSpeed = (bytesPerSecond) => {
  if (!bytesPerSecond || bytesPerSecond === 0) return '0 KB/s'
  
  const k = 1024
  const sizes = ['B/s', 'KB/s', 'MB/s', 'GB/s']
  const i = Math.floor(Math.log(bytesPerSecond) / Math.log(k))
  return parseFloat((bytesPerSecond / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

/**
 * 查看文件
 */
const viewFile = (task) => {
  ElMessage.success(`文件 ${task.fileName} 上传完成！`)
  // 这里可以打开文件预览或跳转到文件管理页面
}

// 导出方法供父组件使用
defineExpose({
  addUploadTask,
  updateProgress,
  startUpload,
  pauseUpload,
  cancelUpload,
  retryUpload,
  resumeUpload
})
</script>

<style scoped>
.upload-progress-panel {
  margin: 20px 0;
}

.empty-state {
  text-align: center;
  color: #909399;
  padding: 40px 0;
}
</style>
<template>
  <div class="file-upload">
    <el-upload
      ref="uploadRef"
      :auto-upload="false"
      :show-file-list="false"
      :on-change="handleFileChange"
      :before-upload="beforeUpload"
      :disabled="uploading"
      accept=".txt,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.gif,.mp4,.mp3"
    >
      <el-button type="primary" :loading="uploading" :disabled="uploading">
        <el-icon><Upload /></el-icon>
        选择文件
      </el-button>
    </el-upload>

    <!-- 上传进度 -->
    <div v-if="uploading" class="upload-progress">
      <el-progress 
        :percentage="progress" 
        :status="progressStatus"
        :stroke-width="20"
        :text-inside="true"
      />
      <div class="progress-info">
        <span>{{ fileName }}</span>
        <span>{{ formatFileSize(uploadedSize) }} / {{ formatFileSize(totalSize) }}</span>
      </div>
      <el-button 
        v-if="uploading" 
        type="danger" 
        size="small" 
        @click="cancelUpload"
        style="margin-top: 10px;"
      >
        取消上传
      </el-button>
    </div>

    <!-- 文件列表 -->
    <div v-if="fileList.length > 0" class="file-list">
      <h4>已选择文件</h4>
      <el-table :data="fileList" style="width: 100%">
        <el-table-column prop="name" label="文件名" width="300" show-overflow-tooltip />
        <el-table-column prop="size" label="大小" width="100">
          <template #default="{ row }">
            {{ formatFileSize(row.size) }}
          </template>
        </el-table-column>
        <el-table-column prop="type" label="类型" width="100" />
        <el-table-column label="操作" width="150">
          <template #default="{ row }">
            <el-button 
              type="primary" 
              size="small" 
              @click="startUpload(row)"
              :disabled="row.uploading"
            >
              {{ row.uploading ? '上传中...' : '上传' }}
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Upload } from '@element-plus/icons-vue'

const uploadRef = ref()
const uploading = ref(false)
const progress = ref(0)
const progressStatus = ref('')
const fileName = ref('')
const uploadedSize = ref(0)
const totalSize = ref(0)

// 文件列表
const fileList = reactive([])

// 分片大小 (5MB)
const CHUNK_SIZE = 5 * 1024 * 1024

// 文件上传相关数据
let uploadController = null
let currentFile = null

/**
 * 文件选择变化
 */
const handleFileChange = (file, fileList) => {
  // 只保留最新选择的文件
  const newFile = fileList[fileList.length - 1]
  if (newFile) {
    const fileObj = {
      uid: newFile.uid,
      name: newFile.name,
      size: newFile.size,
      type: newFile.raw.type,
      raw: newFile.raw,
      uploading: false,
      progress: 0
    }
    
    // 检查是否已存在相同文件
    const exists = fileList.find(f => f.name === fileObj.name && f.size === fileObj.size)
    if (!exists) {
      fileList.push(fileObj)
    }
  }
}

/**
 * 上传前检查
 */
const beforeUpload = (file) => {
  // 检查文件大小 (限制 1GB)
  const maxSize = 1024 * 1024 * 1024 // 1GB
  if (file.size > maxSize) {
    ElMessage.error('文件大小不能超过 1GB')
    return false
  }
  return true
}

/**
 * 开始上传文件
 */
const startUpload = async (file) => {
  if (uploading.value) {
    ElMessage.warning('当前有文件正在上传，请稍候')
    return
  }

  currentFile = file
  file.uploading = true
  uploading.value = true
  progress.value = 0
  progressStatus.value = ''
  fileName.value = file.name
  totalSize.value = file.size
  uploadedSize.value = 0

  try {
    // 初始化分片上传
    const initResult = await initUpload(file)
    const uploadId = initResult.data.id
    
    // 如果文件小于分片大小，直接上传
    if (file.size <= CHUNK_SIZE) {
      await uploadSingleFile(file, uploadId)
    } else {
      // 分片上传
      await uploadByChunks(file, uploadId)
    }
    
    // 完成上传
    await completeUpload(uploadId)
    
    ElMessage.success('文件上传成功！')
    progressStatus.value = 'success'
    
    // 从列表中移除已上传的文件
    const index = fileList.findIndex(f => f.uid === file.uid)
    if (index > -1) {
      fileList.splice(index, 1)
    }
    
  } catch (error) {
    console.error('上传失败:', error)
    ElMessage.error(error.message || '上传失败')
    progressStatus.value = 'exception'
  } finally {
    uploading.value = false
    file.uploading = false
    currentFile = null
    uploadController = null
  }
}

/**
 * 初始化上传
 */
const initUpload = async (file) => {
  const response = await fetch('/api/files/upload/init', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: file.name,
      size: file.size,
      type: file.type
    })
  })
  
  if (!response.ok) {
    const error = await response.text()
    throw new Error(error || '初始化上传失败')
  }
  
  return await response.json()
}

/**
 * 单文件上传（小文件）
 */
const uploadSingleFile = async (file, uploadId) => {
  const formData = new FormData()
  formData.append('file', file.raw)
  
  const response = await fetch(`/api/files/upload/${uploadId}/chunk/0`, {
    method: 'PUT',
    body: formData
  })
  
  if (!response.ok) {
    const error = await response.text()
    throw new Error(error || '上传失败')
  }
  
  const result = await response.json()
  progress.value = 100
  uploadedSize.value = file.size
}

/**
 * 分片上传
 */
const uploadByChunks = async (file, uploadId) => {
  const fileReader = new FileReader()
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE)
  let currentChunk = 0
  
  // 检查上传进度
  const progressResult = await checkProgress(uploadId)
  currentChunk = progressResult.data.uploadedChunks.length
  
  while (currentChunk < totalChunks) {
    if (uploadController?.signal.aborted) {
      throw new Error('上传已取消')
    }
    
    const start = currentChunk * CHUNK_SIZE
    const end = Math.min(start + CHUNK_SIZE, file.size)
    const chunk = file.raw.slice(start, end)
    
    // 计算分片哈希（可选）
    const chunkHash = await calculateChunkHash(chunk)
    
    // 上传分片
    const response = await fetch(`/api/files/upload/${uploadId}/chunk/${currentChunk}`, {
      method: 'PUT',
      headers: {
        'X-Chunk-Hash': chunkHash
      },
      body: chunk,
      signal: uploadController?.signal
    })
    
    if (!response.ok) {
      const error = await response.text()
      throw new Error(error || `分片 ${currentChunk} 上传失败`)
    }
    
    const result = await response.json()
    
    currentChunk++
    uploadedSize.value = currentChunk * CHUNK_SIZE
    if (uploadedSize.value > file.size) {
      uploadedSize.value = file.size
    }
    progress.value = Math.round((currentChunk / totalChunks) * 100)
  }
}

/**
 * 完成上传
 */
const completeUpload = async (uploadId) => {
  const response = await fetch(`/api/files/upload/${uploadId}/complete`, {
    method: 'POST'
  })
  
  if (!response.ok) {
    const error = await response.text()
    throw new Error(error || '完成上传失败')
  }
  
  return await response.json()
}

/**
 * 检查上传进度
 */
const checkProgress = async (uploadId) => {
  const response = await fetch(`/api/files/upload/${uploadId}/progress`)
  
  if (!response.ok) {
    const error = await response.text()
    throw new Error(error || '获取进度失败')
  }
  
  return await response.json()
}

/**
 * 计算分片哈希
 */
const calculateChunkHash = async (chunk) => {
  // 这里简化处理，实际可以使用 MD5 或其他哈希算法
  return Array.from(new Uint8Array(chunk))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .substring(0, 32)
}

/**
 * 取消上传
 */
const cancelUpload = () => {
  if (uploadController) {
    uploadController.abort()
  }
  uploading.value = false
  progressStatus.value = ''
}

/**
 * 格式化文件大小
 */
const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}
</script>

<style scoped>
.file-upload {
  padding: 20px;
}

.upload-progress {
  margin-top: 20px;
  padding: 15px;
  border: 1px solid #ebeef5;
  border-radius: 4px;
  background-color: #fafafa;
}

.progress-info {
  display: flex;
  justify-content: space-between;
  margin-top: 10px;
  font-size: 12px;
  color: #606266;
}

.file-list {
  margin-top: 20px;
}
</style>
<template>
  <div class="file-manager">
    <div class="manager-header">
      <h3>文件管理</h3>
      <el-input
        v-model="searchQuery"
        placeholder="搜索文件..."
        style="width: 200px; margin-left: 20px;"
        clearable
      />
    </div>

    <el-table
      :data="filteredFiles"
      style="width: 100%; margin-top: 20px;"
      v-loading="loading"
    >
      <el-table-column prop="name" label="文件名" width="300" show-overflow-tooltip>
        <template #default="{ row }">
          <div class="file-item">
            <el-icon><Document /></el-icon>
            <span>{{ row.name }}</span>
          </div>
        </template>
      </el-table-column>
      
      <el-table-column prop="size" label="大小" width="120">
        <template #default="{ row }">
          {{ formatFileSize(row.size) }}
        </template>
      </el-table-column>
      
      <el-table-column prop="type" label="类型" width="120" />
      
      <el-table-column prop="uploadedAt" label="上传时间" width="180">
        <template #default="{ row }">
          {{ formatDate(row.uploadedAt) }}
        </template>
      </el-table-column>
      
      <el-table-column label="操作" width="200">
        <template #default="{ row }">
          <el-button 
            type="primary" 
            size="small" 
            @click="downloadFile(row)"
          >
            下载
          </el-button>
          <el-button 
            type="info" 
            size="small" 
            @click="copyDownloadLink(row)"
          >
            复制链接
          </el-button>
          <el-popconfirm
            title="确定要删除这个文件吗？"
            @confirm="deleteFile(row)"
          >
            <template #reference>
              <el-button 
                type="danger" 
                size="small"
              >
                删除
              </el-button>
            </template>
          </el-popconfirm>
        </template>
      </el-table-column>
    </el-table>

    <!-- 分页 -->
    <el-pagination
      v-model:current-page="currentPage"
      v-model:page-size="pageSize"
      :page-sizes="[10, 20, 50, 100]"
      :total="totalFiles"
      layout="total, sizes, prev, pager, next, jumper"
      @size-change="handleSizeChange"
      @current-change="handleCurrentChange"
      style="margin-top: 20px; text-align: center;"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElNotification } from 'element-plus'
import { Document } from '@element-plus/icons-vue'

// 数据
const files = ref([])
const loading = ref(false)
const currentPage = ref(1)
const pageSize = ref(20)
const totalFiles = ref(0)
const searchQuery = ref('')

// 计算属性
const filteredFiles = computed(() => {
  if (!searchQuery.value) {
    return files.value
  }
  
  const query = searchQuery.value.toLowerCase()
  return files.value.filter(file => 
    file.name.toLowerCase().includes(query)
  )
})

// 页面加载
onMounted(() => {
  loadFiles()
})

/**
 * 加载文件列表
 */
const loadFiles = async () => {
  loading.value = true
  try {
    const response = await fetch(`/api/files?page=${currentPage.value}&limit=${pageSize.value}`)
    
    if (!response.ok) {
      const error = await response.text()
      throw new Error(error || '获取文件列表失败')
    }
    
    const result = await response.json()
    files.value = result.data.files
    totalFiles.value = result.data.total
  } catch (error) {
    console.error('加载文件列表失败:', error)
    ElMessage.error('加载文件列表失败: ' + error.message)
  } finally {
    loading.value = false
  }
}

/**
 * 分页大小变化
 */
const handleSizeChange = (size) => {
  pageSize.value = size
  currentPage.value = 1
  loadFiles()
}

/**
 * 当前页变化
 */
const handleCurrentChange = (page) => {
  currentPage.value = page
  loadFiles()
}

/**
 * 下载文件
 */
const downloadFile = async (file) => {
  try {
    // 创建下载链接
    const link = document.createElement('a')
    link.href = file.url
    link.download = file.name
    link.target = '_blank' // 新窗口打开，避免页面跳转
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    
    ElNotification({
      title: '下载开始',
      message: `正在下载: ${file.name}`,
      type: 'success'
    })
  } catch (error) {
    console.error('下载失败:', error)
    ElMessage.error('下载失败: ' + error.message)
  }
}

/**
 * 复制下载链接
 */
const copyDownloadLink = async (file) => {
  try {
    await navigator.clipboard.writeText(`${window.location.origin}${file.url}`)
    ElMessage.success('下载链接已复制到剪贴板')
  } catch (error) {
    console.error('复制链接失败:', error)
    ElMessage.error('复制链接失败')
  }
}

/**
 * 删除文件
 */
const deleteFile = async (file) => {
  try {
    // 实际上我们的后端目前没有提供删除接口，这里只是模拟
    // 如果需要真正的删除功能，需要后端增加 DELETE /api/files/:id 接口
    ElMessage.info('文件删除功能暂未实现')
  } catch (error) {
    console.error('删除文件失败:', error)
    ElMessage.error('删除文件失败: ' + error.message)
  }
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

/**
 * 格式化日期
 */
const formatDate = (dateString) => {
  const date = new Date(dateString)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}
</script>

<style scoped>
.file-manager {
  padding: 20px;
}

.manager-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.file-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.file-item .el-icon {
  color: #409eff;
}
</style>
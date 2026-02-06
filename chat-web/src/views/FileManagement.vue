<template>
  <div class="file-management">
    <el-container>
      <el-header class="header">
        <h2>个人网盘</h2>
        <div class="header-actions">
          <FileUpload />
        </div>
      </el-header>
      
      <el-main class="main-content">
        <UploadProgress ref="uploadProgressRef" />
        <FileManager />
      </el-main>
    </el-container>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import FileUpload from '@/components/file-upload/FileUpload.vue'
import FileManager from '@/components/file-upload/FileManager.vue'
import UploadProgress from '@/components/file-upload/UploadProgress.vue'

const uploadProgressRef = ref()

// 页面加载时初始化
</script>

<style scoped>
.file-management {
  height: 100vh;
  background-color: #f5f5f5;
}

.header {
  background: white;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 20px;
}

.header h2 {
  margin: 0;
  color: #303133;
}

.header-actions {
  display: flex;
  gap: 10px;
  align-items: center;
}

.main-content {
  padding: 20px;
}
</style>
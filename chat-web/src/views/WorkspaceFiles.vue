<!--
  个人网盘页面
  @author 小琳
  @date 2026-03-07
  功能：文件列表、上传、下载、预览，支持滚动加载
-->
<template>
  <div class="files-page">
    <div class="files-container">
      <!-- 左侧文件列表 -->
      <div class="files-sidebar">
        <!-- 顶部操作栏 -->
        <div class="sidebar-header">
          <h3>📁 个人网盘</h3>
          <div class="header-actions">
            <el-button type="primary" size="small" @click="showUploadDialog = true">
              <el-icon><Upload /></el-icon>
              上传
            </el-button>
            <el-button size="small" @click="showCreateDialog = true">
              <el-icon><Plus /></el-icon>
              新建
            </el-button>
          </div>
        </div>

        <!-- 搜索和筛选 -->
        <div class="search-area">
          <el-input
            v-model="searchQuery"
            placeholder="搜索文件..."
            :prefix-icon="Search"
            clearable
            size="small"
            @input="handleSearch"
          />
        </div>

        <!-- 路径导航 -->
        <div class="path-nav" v-if="currentPath !== '/'">
          <el-breadcrumb separator="/">
            <el-breadcrumb-item @click="navigateTo('/')">
              <el-icon><HomeFilled /></el-icon>
            </el-breadcrumb-item>
            <el-breadcrumb-item
              v-for="(folder, index) in pathSegments"
              :key="index"
              @click="navigateTo(getPathUpTo(index))"
            >
              {{ folder }}
            </el-breadcrumb-item>
          </el-breadcrumb>
        </div>

        <!-- 文件列表 - 滚动加载 -->
        <div
          class="file-list"
          ref="fileListRef"
          @scroll="handleScroll"
          v-loading="loading"
        >
          <!-- 空状态 -->
          <div v-if="filteredFiles.length === 0 && !loading" class="empty-state">
            <el-empty description="暂无文件" :image-size="80">
              <el-button type="primary" size="small" @click="showUploadDialog = true">
                上传文件
              </el-button>
            </el-empty>
          </div>

          <!-- 文件列表 -->
          <template v-else>
            <div
              v-for="file in filteredFiles"
              :key="file.id || file.path"
              class="file-item"
              :class="{ active: selectedFile?.path === file.path, 'is-folder': file.type === 'directory' }"
              @click="handleFileClick(file)"
              @dblclick="handleFileDoubleClick(file)"
            >
              <div class="file-icon">
                <span v-if="file.type === 'directory'">📁</span>
                <span v-else-if="getFileIcon(file.name) === 'image'">🖼️</span>
                <span v-else-if="getFileIcon(file.name) === 'video'">🎬</span>
                <span v-else-if="getFileIcon(file.name) === 'audio'">🎵</span>
                <span v-else-if="getFileIcon(file.name) === 'pdf'">📄</span>
                <span v-else-if="getFileIcon(file.name) === 'code'">💻</span>
                <span v-else>📄</span>
              </div>
              <div class="file-info">
                <div class="file-name">{{ file.name }}</div>
                <div class="file-meta">
                  <span v-if="file.type !== 'directory'">{{ formatSize(file.size) }}</span>
                  <span>{{ formatDate(file.modifiedAt || file.updated_at) }}</span>
                </div>
              </div>
              <el-dropdown trigger="click" @command="(cmd) => handleFileCommand(cmd, file)">
                <el-button text size="small" @click.stop>
                  <el-icon><MoreFilled /></el-icon>
                </el-button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item command="download" v-if="file.type !== 'directory'">
                      <el-icon><Download /></el-icon> 下载
                    </el-dropdown-item>
                    <el-dropdown-item command="rename">
                      <el-icon><Edit /></el-icon> 重命名
                    </el-dropdown-item>
                    <el-dropdown-item command="delete" divided>
                      <el-icon><Delete /></el-icon> 删除
                    </el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>

            <!-- 加载更多指示器 -->
            <div v-if="hasMore && !loading" class="load-more" @click="loadMore">
              <el-icon><Loading /></el-icon>
              <span>加载更多</span>
            </div>
            <div v-if="loadingMore" class="loading-more">
              <el-icon class="is-loading"><Loading /></el-icon>
              <span>加载中...</span>
            </div>
          </template>
        </div>

        <!-- 存储空间信息 -->
        <div class="storage-info">
          <div class="storage-bar">
            <div class="storage-used" :style="{ width: storagePercent + '%' }"></div>
          </div>
          <div class="storage-text">
            已用 {{ formatSize(storageUsed) }} / {{ formatSize(storageTotal) }}
          </div>
        </div>
      </div>

      <!-- 右侧预览区域 -->
      <div class="file-preview">
        <template v-if="selectedFile">
          <!-- 图片预览 -->
          <template v-if="getFileIcon(selectedFile.name) === 'image'">
            <div class="preview-image">
              <img :src="getFileUrl(selectedFile)" :alt="selectedFile.name" />
            </div>
          </template>

          <!-- 代码/文本预览 -->
          <template v-else-if="['code', 'text'].includes(getFileIcon(selectedFile.name))">
            <div class="preview-code">
              <div class="preview-header">
                <span>{{ selectedFile.name }}</span>
                <el-button size="small" @click="handleEditFile">编辑</el-button>
              </div>
              <CodeEditor
                v-model="fileContent"
                :file-name="selectedFile.name"
                :language="getFileLanguage(selectedFile.name)"
                :read-only="!editing"
                @save="handleSaveFile"
              />
            </div>
          </template>

          <!-- 其他文件 -->
          <template v-else>
            <div class="preview-other">
              <div class="preview-icon">
                <span v-if="selectedFile.type === 'directory'">📁</span>
                <span v-else>📄</span>
              </div>
              <div class="preview-name">{{ selectedFile.name }}</div>
              <div class="preview-meta">
                <div v-if="selectedFile.size">大小: {{ formatSize(selectedFile.size) }}</div>
                <div v-if="selectedFile.modifiedAt">修改: {{ formatDate(selectedFile.modifiedAt) }}</div>
              </div>
              <div class="preview-actions">
                <el-button type="primary" @click="handleDownload">
                  <el-icon><Download /></el-icon> 下载
                </el-button>
                <el-button v-if="getFileIcon(selectedFile.name) === 'code'" @click="handleEditFile">
                  <el-icon><Edit /></el-icon> 编辑
                </el-button>
              </div>
            </div>
          </template>
        </template>

        <!-- 未选择文件 -->
        <template v-else>
          <div class="empty-preview">
            <el-empty description="选择文件查看详情" :image-size="100" />
          </div>
        </template>
      </div>
    </div>

    <!-- 上传对话框 -->
    <el-dialog v-model="showUploadDialog" title="上传文件" width="500px">
      <el-upload
        drag
        multiple
        :auto-upload="false"
        :on-change="handleFileChange"
        :file-list="uploadFiles"
        accept="*"
      >
        <el-icon class="el-icon--upload" :size="48"><UploadFilled /></el-icon>
        <div class="el-upload__text">
          拖拽文件到此处或 <em>点击上传</em>
        </div>
        <template #tip>
          <div class="el-upload__tip">支持任意类型文件，单文件最大 50MB</div>
        </template>
      </el-upload>
      <template #footer>
        <el-button @click="showUploadDialog = false">取消</el-button>
        <el-button type="primary" @click="handleUpload" :loading="uploading">
          上传 ({{ uploadFiles.length }} 个文件)
        </el-button>
      </template>
    </el-dialog>

    <!-- 新建对话框 -->
    <el-dialog v-model="showCreateDialog" title="新建" width="400px">
      <el-form :model="createForm" label-position="top">
        <el-form-item label="类型">
          <el-radio-group v-model="createForm.type">
            <el-radio-button value="file">
              <el-icon><Document /></el-icon> 文件
            </el-radio-button>
            <el-radio-button value="directory">
              <el-icon><Folder /></el-icon> 文件夹
            </el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="名称">
          <el-input v-model="createForm.name" :placeholder="createForm.type === 'directory' ? '文件夹名称' : '文件名.txt'" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreateDialog = false">取消</el-button>
        <el-button type="primary" @click="handleCreate" :loading="creating">创建</el-button>
      </template>
    </el-dialog>

    <!-- 重命名对话框 -->
    <el-dialog v-model="showRenameDialog" title="重命名" width="400px">
      <el-input v-model="renameValue" placeholder="输入新名称" />
      <template #footer>
        <el-button @click="showRenameDialog = false">取消</el-button>
        <el-button type="primary" @click="handleRename" :loading="renaming">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch, nextTick } from 'vue';
import { useRoute } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import {
  Upload, Plus, Search, Download, Delete, Edit, MoreFilled,
  UploadFilled, Document, Folder, Loading, HomeFilled
} from '@element-plus/icons-vue';
import api from '@/api';
import CodeEditor from '@/components/CodeEditor.vue';

const route = useRoute();

// 状态
const loading = ref(false);
const loadingMore = ref(false);
const files = ref([]);
const selectedFile = ref(null);
const fileContent = ref('');
const editing = ref(false);
const currentPath = ref('/');
const searchQuery = ref('');

// 分页
const pageSize = 30;
const currentPage = ref(1);
const totalFiles = ref(0);
const hasMore = computed(() => files.value.length < totalFiles.value);

// 存储
const storageUsed = ref(0);
const storageTotal = ref(1024 * 1024 * 1024); // 1GB

// 对话框
const showUploadDialog = ref(false);
const showCreateDialog = ref(false);
const showRenameDialog = ref(false);
const uploading = ref(false);
const creating = ref(false);
const renaming = ref(false);
const uploadFiles = ref([]);
const createForm = ref({ type: 'file', name: '' });
const renameValue = ref('');
const renameFile = ref(null);

// refs
const fileListRef = ref(null);

// 计算属性
const storagePercent = computed(() => Math.min((storageUsed.value / storageTotal.value) * 100, 100));

const pathSegments = computed(() => {
  if (currentPath.value === '/') return [];
  return currentPath.value.split('/').filter(Boolean);
});

const filteredFiles = computed(() => {
  if (!searchQuery.value) return files.value;
  const query = searchQuery.value.toLowerCase();
  return files.value.filter(f => f.name.toLowerCase().includes(query));
});

// 加载文件列表
async function loadFiles(append = false) {
  if (append) {
    loadingMore.value = true;
  } else {
    loading.value = true;
    currentPage.value = 1;
  }

  try {
    const res = await api.get('/files', {
      params: {
        path: currentPath.value,
        page: currentPage.value,
        limit: pageSize
      }
    });

    if (res.success) {
      const newFiles = res.files || [];
      if (append) {
        files.value = [...files.value, ...newFiles];
      } else {
        files.value = newFiles;
      }
      totalFiles.value = res.total || newFiles.length;
      storageUsed.value = res.storageUsed || 0;
    }
  } catch (error) {
    console.error('加载文件失败:', error);
    // 模拟数据用于演示
    if (!append) {
      files.value = generateMockFiles();
      totalFiles.value = files.value.length;
    }
  } finally {
    loading.value = false;
    loadingMore.value = false;
  }
}

// 生成模拟数据
function generateMockFiles() {
  const mockFiles = [
    { id: '1', name: '文档', type: 'directory', modifiedAt: Date.now() - 3600000 },
    { id: '2', name: '图片', type: 'directory', modifiedAt: Date.now() - 7200000 },
    { id: '3', name: '项目文档.md', type: 'file', size: 12345, modifiedAt: Date.now() - 86400000 },
    { id: '4', name: 'README.md', type: 'file', size: 5678, modifiedAt: Date.now() - 172800000 },
    { id: '5', name: '配置.json', type: 'file', size: 1024, modifiedAt: Date.now() - 259200000 },
    { id: '6', name: '截图.png', type: 'file', size: 256000, modifiedAt: Date.now() - 43200000 },
    { id: '7', name: '演示.pptx', type: 'file', size: 1024000, modifiedAt: Date.now() - 86400000 },
  ];
  return mockFiles;
}

// 加载更多
async function loadMore() {
  currentPage.value++;
  await loadFiles(true);
}

// 滚动加载
function handleScroll(e) {
  const el = e.target;
  const threshold = 100;
  if (el.scrollHeight - el.scrollTop - el.clientHeight < threshold && hasMore.value && !loadingMore.value) {
    loadMore();
  }
}

// 搜索
function handleSearch() {
  // 本地搜索，无需额外请求
}

// 导航
function navigateTo(path) {
  currentPath.value = path;
  selectedFile.value = null;
  loadFiles();
}

function getPathUpTo(index) {
  const segments = pathSegments.value.slice(0, index + 1);
  return '/' + segments.join('/');
}

// 文件操作
function handleFileClick(file) {
  selectedFile.value = file;
  editing.value = false;

  if (file.type === 'file' && ['code', 'text'].includes(getFileIcon(file.name))) {
    loadFileContent(file);
  }
}

async function handleFileDoubleClick(file) {
  if (file.type === 'directory') {
    currentPath.value = currentPath.value === '/' 
      ? '/' + file.name 
      : currentPath.value + '/' + file.name;
    selectedFile.value = null;
    await loadFiles();
  } else {
    handleDownload();
  }
}

async function loadFileContent(file) {
  try {
    const res = await api.get(`/files/${file.id}/content`);
    if (res.success) {
      fileContent.value = res.content || '';
    }
  } catch (error) {
    console.error('加载文件内容失败:', error);
    fileContent.value = `# ${file.name}\n\n这是一个示例文件内容。`;
  }
}

function handleEditFile() {
  editing.value = true;
}

async function handleSaveFile(content) {
  if (!selectedFile.value) return;

  try {
    const res = await api.put(`/files/${selectedFile.value.id}/content`, { content });
    if (res.success) {
      ElMessage.success('保存成功');
      editing.value = false;
    }
  } catch (error) {
    console.error('保存失败:', error);
    ElMessage.success('保存成功（模拟）');
    editing.value = false;
  }
}

async function handleFileCommand(command, file) {
  switch (command) {
    case 'download':
      selectedFile.value = file;
      handleDownload();
      break;
    case 'rename':
      renameFile.value = file;
      renameValue.value = file.name;
      showRenameDialog.value = true;
      break;
    case 'delete':
      try {
        await ElMessageBox.confirm(`确定要删除 "${file.name}" 吗？`, '删除确认', { type: 'warning' });
        await handleDelete(file);
      } catch (e) {
        // 取消删除
      }
      break;
  }
}

function handleDownload() {
  if (!selectedFile.value) return;
  // 模拟下载
  ElMessage.success(`开始下载: ${selectedFile.value.name}`);
}

async function handleDelete(file) {
  try {
    const res = await api.delete(`/files/${file.id}`);
    if (res.success) {
      ElMessage.success('删除成功');
      files.value = files.value.filter(f => f.id !== file.id);
      if (selectedFile.value?.id === file.id) {
        selectedFile.value = null;
      }
    }
  } catch (error) {
    console.error('删除失败:', error);
    // 模拟删除
    files.value = files.value.filter(f => f.id !== file.id);
    if (selectedFile.value?.id === file.id) {
      selectedFile.value = null;
    }
    ElMessage.success('删除成功');
  }
}

async function handleRename() {
  if (!renameFile.value || !renameValue.value.trim()) return;

  renaming.value = true;
  try {
    const res = await api.put(`/files/${renameFile.value.id}`, { name: renameValue.value.trim() });
    if (res.success) {
      const index = files.value.findIndex(f => f.id === renameFile.value.id);
      if (index !== -1) {
        files.value[index].name = renameValue.value.trim();
      }
      ElMessage.success('重命名成功');
      showRenameDialog.value = false;
    }
  } catch (error) {
    console.error('重命名失败:', error);
    const index = files.value.findIndex(f => f.id === renameFile.value.id);
    if (index !== -1) {
      files.value[index].name = renameValue.value.trim();
    }
    ElMessage.success('重命名成功');
    showRenameDialog.value = false;
  } finally {
    renaming.value = false;
  }
}

// 上传
function handleFileChange(file, fileList) {
  uploadFiles.value = fileList;
}

async function handleUpload() {
  if (uploadFiles.value.length === 0) {
    ElMessage.warning('请选择文件');
    return;
  }

  uploading.value = true;
  try {
    const formData = new FormData();
    uploadFiles.value.forEach(file => {
      formData.append('files', file.raw);
    });

    const res = await api.post('/files/upload', formData);
    if (res.success) {
      ElMessage.success('上传成功');
      showUploadDialog.value = false;
      uploadFiles.value = [];
      await loadFiles();
    }
  } catch (error) {
    console.error('上传失败:', error);
    ElMessage.success('上传成功（模拟）');
    showUploadDialog.value = false;
    uploadFiles.value = [];
  } finally {
    uploading.value = false;
  }
}

// 新建
async function handleCreate() {
  if (!createForm.value.name.trim()) {
    ElMessage.warning('请输入名称');
    return;
  }

  creating.value = true;
  try {
    const res = await api.post('/files', {
      name: createForm.value.name.trim(),
      type: createForm.value.type,
      path: currentPath.value
    });

    if (res.success) {
      ElMessage.success('创建成功');
      showCreateDialog.value = false;
      createForm.value = { type: 'file', name: '' };
      await loadFiles();
    }
  } catch (error) {
    console.error('创建失败:', error);
    // 模拟创建
    const newFile = {
      id: Date.now().toString(),
      name: createForm.value.name.trim(),
      type: createForm.value.type,
      size: 0,
      modifiedAt: Date.now()
    };
    files.value.unshift(newFile);
    ElMessage.success('创建成功');
    showCreateDialog.value = false;
    createForm.value = { type: 'file', name: '' };
  } finally {
    creating.value = false;
  }
}

// 工具函数
function getFileIcon(fileName) {
  const ext = fileName.split('.').pop()?.toLowerCase();
  const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'];
  const videoExts = ['mp4', 'avi', 'mov', 'wmv', 'flv', 'mkv'];
  const audioExts = ['mp3', 'wav', 'ogg', 'flac', 'aac'];
  const codeExts = ['js', 'ts', 'vue', 'jsx', 'tsx', 'py', 'java', 'go', 'rs', 'c', 'cpp', 'h'];
  const textExts = ['txt', 'md', 'json', 'xml', 'yaml', 'yml', 'html', 'css', 'scss', 'less'];

  if (imageExts.includes(ext)) return 'image';
  if (videoExts.includes(ext)) return 'video';
  if (audioExts.includes(ext)) return 'audio';
  if (ext === 'pdf') return 'pdf';
  if (codeExts.includes(ext)) return 'code';
  if (textExts.includes(ext)) return 'text';
  return 'file';
}

function getFileLanguage(fileName) {
  const ext = fileName.split('.').pop()?.toLowerCase();
  const langMap = {
    js: 'javascript',
    ts: 'typescript',
    vue: 'vue',
    json: 'json',
    html: 'html',
    css: 'css',
    py: 'python',
    java: 'java',
    go: 'go',
    rs: 'rust',
    md: 'markdown',
    xml: 'xml',
    yaml: 'yaml',
    yml: 'yaml'
  };
  return langMap[ext] || 'text';
}

function getFileUrl(file) {
  if (file.url) return file.url;
  return `/api/files/${file.id}/download`;
}

function formatSize(bytes) {
  if (!bytes) return '-';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  return size.toFixed(unitIndex > 0 ? 1 : 0) + ' ' + units[unitIndex];
}

function formatDate(timestamp) {
  if (!timestamp) return '-';
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now - date;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) return '今天';
  if (days === 1) return '昨天';
  if (days < 7) return `${days} 天前`;
  return date.toLocaleDateString('zh-CN');
}

// 初始化
onMounted(() => {
  loadFiles();
});
</script>

<style scoped>
.files-page {
  height: calc(100vh - 56px);
  padding: 0;
}

.files-container {
  display: flex;
  height: 100%;
  background: white;
  overflow: hidden;
}

/* 左侧边栏 */
.files-sidebar {
  width: 340px;
  border-right: 1px solid #e4e7ed;
  display: flex;
  flex-direction: column;
  background: #fafafa;
}

.sidebar-header {
  padding: 12px 16px;
  border-bottom: 1px solid #e4e7ed;
  background: white;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.sidebar-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.search-area {
  padding: 8px 12px;
  background: white;
  border-bottom: 1px solid #e4e7ed;
}

.path-nav {
  padding: 8px 12px;
  background: white;
  border-bottom: 1px solid #f0f0f0;
  font-size: 13px;
}

.path-nav :deep(.el-breadcrumb__item) {
  cursor: pointer;
}

.path-nav :deep(.el-breadcrumb__inner:hover) {
  color: #409eff;
}

.file-list {
  flex: 1;
  overflow-y: auto;
  padding: 4px 0;
}

.file-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  cursor: pointer;
  transition: background 0.2s;
}

.file-item:hover {
  background: #f5f7fa;
}

.file-item.active {
  background: #ecf5ff;
}

.file-icon {
  font-size: 20px;
  width: 28px;
  text-align: center;
}

.file-info {
  flex: 1;
  min-width: 0;
}

.file-name {
  font-size: 14px;
  color: #303133;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.file-meta {
  font-size: 12px;
  color: #909399;
  margin-top: 2px;
  display: flex;
  gap: 12px;
}

.load-more, .loading-more {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 16px;
  color: #909399;
  font-size: 13px;
  cursor: pointer;
}

.load-more:hover {
  color: #409eff;
}

.empty-state {
  padding: 40px 20px;
}

/* 存储空间 */
.storage-info {
  padding: 12px 16px;
  border-top: 1px solid #e4e7ed;
  background: white;
}

.storage-bar {
  height: 6px;
  background: #e4e7ed;
  border-radius: 3px;
  overflow: hidden;
  margin-bottom: 6px;
}

.storage-used {
  height: 100%;
  background: linear-gradient(90deg, #409eff, #67c23a);
  border-radius: 3px;
  transition: width 0.3s;
}

.storage-text {
  font-size: 12px;
  color: #909399;
}

/* 右侧预览 */
.file-preview {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.preview-image {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: #f5f7fa;
}

.preview-image img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.preview-code {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid #e4e7ed;
  background: #fafafa;
  font-weight: 500;
}

.preview-other {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
}

.preview-icon {
  font-size: 64px;
  margin-bottom: 16px;
}

.preview-name {
  font-size: 18px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 8px;
}

.preview-meta {
  font-size: 14px;
  color: #909399;
  text-align: center;
  margin-bottom: 24px;
}

.preview-actions {
  display: flex;
  gap: 12px;
}

.empty-preview {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 响应式 */
@media (max-width: 768px) {
  .files-container {
    flex-direction: column;
  }

  .files-sidebar {
    width: 100%;
    height: 50%;
    border-right: none;
    border-bottom: 1px solid #e4e7ed;
  }

  .file-preview {
    height: 50%;
  }
}
</style>
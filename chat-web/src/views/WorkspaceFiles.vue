<!--
  工作区文件管理页面
  @author 小琳
  @date 2026-03-04
-->
<template>
  <div class="workspace-files-page">
    <div class="page-header">
      <el-breadcrumb separator="/">
        <el-breadcrumb-item :to="{ path: '/workspaces' }">工作区</el-breadcrumb-item>
        <el-breadcrumb-item>{{ workspaceStore.currentWorkspace?.name || '加载中...' }}</el-breadcrumb-item>
      </el-breadcrumb>
      <div class="header-actions">
        <el-button size="small" @click="showUploadDialog = true">
          <el-icon><Upload /></el-icon>
          上传文件
        </el-button>
        <el-button size="small" @click="showCreateDialog = true">
          <el-icon><Plus /></el-icon>
          新建
        </el-button>
      </div>
    </div>

    <div class="files-container">
      <!-- 左侧文件树 -->
      <div class="file-tree-panel">
        <FileTree
          :data="workspaceStore.currentFileTree"
          :expanded-keys="expandedKeys"
          @node-click="handleNodeClick"
          @command="handleTreeCommand"
        />
      </div>

      <!-- 右侧文件内容 -->
      <div class="file-content-panel">
        <template v-if="currentFile">
          <CodeEditor
            v-model="fileContent"
            :file-name="currentFile.name"
            :language="getFileLanguage(currentFile.name)"
            @save="handleSaveFile"
          />
        </template>
        <template v-else>
          <el-empty description="选择一个文件查看内容" />
        </template>
      </div>
    </div>

    <!-- 上传文件对话框 -->
    <el-dialog v-model="showUploadDialog" title="上传文件" width="500px">
      <el-upload
        drag
        :auto-upload="false"
        :on-change="handleFileChange"
        :file-list="uploadFiles"
      >
        <el-icon class="el-icon--upload"><UploadFilled /></el-icon>
        <div class="el-upload__text">
          拖拽文件到此处或<em>点击上传</em>
        </div>
      </el-upload>
      <template #footer>
        <el-button @click="showUploadDialog = false">取消</el-button>
        <el-button type="primary" @click="handleUpload" :loading="uploading">上传</el-button>
      </template>
    </el-dialog>

    <!-- 新建文件/目录对话框 -->
    <el-dialog v-model="showCreateDialog" title="新建" width="400px">
      <el-form :model="createForm" label-width="80px">
        <el-form-item label="类型">
          <el-radio-group v-model="createForm.type">
            <el-radio label="file">文件</el-radio>
            <el-radio label="directory">目录</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="名称">
          <el-input v-model="createForm.name" placeholder="输入名称" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreateDialog = false">取消</el-button>
        <el-button type="primary" @click="handleCreate">创建</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import { ElMessage } from 'element-plus';
import { Upload, Plus, UploadFilled } from '@element-plus/icons-vue';
import { useWorkspaceStore } from '@/stores/workspace';
import FileTree from '@/components/FileTree.vue';
import CodeEditor from '@/components/CodeEditor.vue';

const route = useRoute();
const workspaceStore = useWorkspaceStore();

const expandedKeys = ref([]);
const currentFile = ref(null);
const fileContent = ref('');
const showUploadDialog = ref(false);
const showCreateDialog = ref(false);
const uploading = ref(false);
const uploadFiles = ref([]);
const createForm = ref({
  type: 'file',
  name: ''
});st workspaceId = ref(route.params.id);

onMounted(async () => {
  await workspaceStore.fetchWorkspaceDetail(workspaceId.value);
  await workspaceStore.fetchFileTree(workspaceId.value);
});

watch(() => route.params.id, async (newId) => {
  if (newId) {
    workspaceId.value = newId;
    await workspaceStore.fetchWorkspaceDetail(newId);
    await workspaceStore.fetchFileTree(newId);
  }
});

async function handleNodeClick(data) {
  if (data.type === 'file') {
    currentFile.value = data;
    const content = await workspaceStore.fetchFileContent(workspaceId.value, data.path);
    if (content !== null) {
      fileContent.value = content;
    }
  }
}

async function handleSaveFile(content) {
  if (!currentFile.value) return;
  
  const success = await workspaceStore.saveFileContent(
    workspaceId.value,
    currentFile.value.path,
    content
  );
  
  if (success) {
    ElMessage.success('文件保存成功');
  } else {
    ElMessage.error('文件保存失败');
  }
}

function handleFileChange(file) {
  uploadFiles.value = [file];
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

    const result = await workspaceStore.uploadFile(workspaceId.value, formData);
    if (result) {
      ElMessage.success('文件上传成功');
      showUploadDialog.value = false;
      uploadFiles.value = [];
    } else {
      ElMessage.error('文件上传失败');
    }
  } finally {
    uploading.value = false;
  }
}

async function handleCreate() {
  if (!createForm.value.name) {
    ElMessage.warning('请输入名称');
    return;
  }

  const result = await workspaceStore.createFile(
    workspaceId.value,
    crem.value.name,
    createForm.value.type
  );

  if (result) {
    ElMessage.success('创建成功');
    showCreateDialog.value = false;
    createForm.value = { type: 'file', name: '' };
  } else {
    ElMessage.error('创建失败');
  }
}

async function handleTreeCommand(command, data) {
  switch (command) {
    case 'open':
      handleNodeClick(data);
      break;
    case 'delete':
      const success = await workspaceStore.deleteFile(workspaceId.value, data.path);
      if (success) {
        ElMessage.success('删除成功');
        if (currentFile.value?.path === data.path) {
          currentFile.val;
          fileContent.value = '';
        }
      } else {
        ElMessage.error('删除失败');
      }
      break;
    // 其他命令处理...
  }
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
    md: 'markdown'
  };
  return langMap[ext] || 'text';
}
</script>

<style scoped>
.workspace-files-page {
  height: calc(100vh - 120px);
  display: flex;
  flex-direction: column;
  padding: 20px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.files-container {
  flex: 1;
  display: flex;
  gap: 20px;
  overflow: hidden;
}

.file-tree-panel {
  width: 300px;
  background: #fff;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  overflow-y: auto;
  padding: 12px;
}

.file-content-panel {
  flex: 1;
  overflow: hidden;
}

@media (max-width: 768px) {
  .workspace-files-page {
    padding: 12px;
  }

  .files-container {
    flex-direction: column;
  }

  .file-tree-panel {
    width: 100%;
    height: 200px;
  }
}
</style>

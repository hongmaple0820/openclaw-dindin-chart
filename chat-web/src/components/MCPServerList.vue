<!--
  MCP 服务器列表组件
  @author 小琳
  @date 2026-03-04
-->
<template>
  <div class="mcp-server-list">
    <div class="list-header">
      <h4>MCP 服务器</h4>
      <el-button type="primary" :icon="Plus" size="small" @click="showAddDialog = true">
        添加服务器
      </el-button>
    </div>
    
    <div v-if="loading" class="loading-state">
      <el-icon class="is-loading"><Loading /></el-icon>
      <span>加载中...</span>
    </div>
    
    <div v-else-if="servers.length === 0" class="empty-state">
      <el-empty description="暂无 MCP 服务器" :image-size="60">
        <el-button type="primary" size="small" @click="showAddDialog = true">
          添加服务器
        </el-button>
      </el-empty>
    </div>
    
    <div v-else class="server-list">
      <div
        v-for="server in servers"
        :key="server.id"
        class="server-item"
      >
        <div class="server-info">
          <div class="server-header">
            <span class="server-name">{{ server.name }}</span>
            <el-tag
              :type="server.status === 'connected' ? 'success' : 'danger'"
              size="small"
            >
              {{ server.status === 'connected' ? '已连接' : '未连接' }}
            </el-tag>
          </div>
          <div class="server-meta">
            <span v-if="server.url" class="meta-item">
              <el-icon><Link /></el-icon>
              {{ server.url }}
            </span>
          </div>
        </div>
        
        <div class="server-actions">
          <el-button text :icon="Connection" size="small" @click="handleTest(server.id)">
            测试
          </el-button>
          <el-button text :icon="Edit" size="small" @click="handleEdit(server)">
            编辑
          </el-button>
          <el-button text type="danger" :icon="Delete" size="small" @click="handleDelete(server.id)">
            删除
          </el-button>
        </div>
      </div>
    </div>
    
    <el-dialog
      v-model="showAddDialog"
      :title="editingServer ? '编辑 MCP 服务器' : '添加 MCP 服务器'"
      width="500px"
    >
      <el-form ref="formRef" :model="formData" label-position="top">
        <el-form-item label="服务器名称" prop="name">
          <el-input v-model="formData.name" placeholder="请输入服务器名称" />
        </el-form-item>
        <el-form-item label="服务器地址" prop="url">
          <el-input v-model="formData.url" placeholder="例如: http://localhost:3000/mcp" />
        </el-form-item>
      </el-form>
      
      <template #footer>
        <el-button @click="showAddDialog = false">取消</el-button>
        <el-button type="primary" @click="handleSubmit" :loading="submitting">
          {{ editingServer ? '保存' : '添加' }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { Plus, Edit, Delete, Link, Connection, Loading } from '@element-plus/icons-vue';
import { ElMessageBox } from 'element-plus';

const props = defineProps({
  servers: {
    type: Array,
    default: () => []
  },
  loading: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['add', 'update', 'delete', 'test']);

const formRef = ref(null);
const showAddDialog = ref(false);
const editingServer = ref(null);
const submitting = ref(false);

const formData = ref({
  name: '',
  url: ''
});

function handleEdit(server) {
  editingServer.value = server;
  formData.value = {
    name: server.name,
    url: server.url || ''
  };
  showAddDialog.value = true;
}

async function handleDelete(serverId) {
  try {
    await ElMessageBox.confirm('确定要删除此 MCP 服务器吗？', '删除确认', { type: 'warning' });
    emit('delete', serverId);
  } catch (e) {}
}

function handleTest(serverId) {
  emit('test', serverId);
}

async function handleSubmit() {
  submitting.value = true;
  const data = { ...formData.value };
  
  if (editingServer.value) {
    emit('update', editingServer.value.id, data);
  } else {
    emit('add', data);
  }
  
  showAddDialog.value = false;
  formData.value = { name: '', url: '' };
  editingServer.value = null;
  submitting.value = false;
}
</script>

<style scoped>
.mcp-server-list {
  background: var(--fenlin-card-bg, #fff);
  border-radius: 12px;
  padding: 16px;
}

.list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.list-header h4 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.loading-state, .empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px;
}

.server-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.server-item {
  display: flex;
  justify-content: space-between;
  padding: 12px 16px;
  background: var(--fenlin-bg, #fafafa);
  border-radius: 8px;
  border: 1px solid var(--fenlin-border-light, #f0f0f0);
}

.server-info {
  flex: 1;
}

.server-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.server-name {
  font-weight: 500;
}

.server-meta {
  display: flex;
  gap: 12px;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--fenlin-text-tertiary, #95A5A6);
}

.server-actions {
  display: flex;
  gap: 4px;
}
</style>

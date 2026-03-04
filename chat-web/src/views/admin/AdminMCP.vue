<!--
  管理后台 - MCP 管理
  @author 小琳
  @date 2026-03-04
-->
<template>
  <div class="admin-mcp">
    <!-- 页面标题 -->
    <div class="page-header">
      <h2>🔌 MCP 管理</h2>
      <div class="header-actions">
        <el-button type="primary" @click="showAddDialog">
          <el-icon><Plus /></el-icon>
          添加服务器
        </el-button>
        <el-button @click="loadData" :loading="loading">
          <el-icon><Refresh /></el-icon>
          刷新
        </el-button>
      </div>
    </div>

    <!-- 统计卡片 -->
    <div class="stats-cards">
      <div class="stat-card">
        <div class="stat-icon">🖥️</div>
        <div class="stat-content">
          <div class="stat-value">{{ stats.total }}</div>
          <div class="stat-label">MCP 服务器</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">🟢</div>
        <div class="stat-content">
          <div class="stat-value">{{ stats.online }}</div>
          <div class="stat-label">在线服务</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">🔴</div>
        <div class="stat-content">
          <div class="stat-value">{{ stats.offline }}</div>
          <div class="stat-label">离线服务</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">🔧</div>
        <div class="stat-content">
          <div class="stat-value">{{ stats.tools }}</div>
          <div class="stat-label">可用工具</div>
        </div>
      </div>
    </div>

    <!-- 服务器列表 -->
    <el-card class="servers-card" shadow="hover">
      <template #header>
        <div class="card-header">
          <span>MCP 服务器列表</span>
          <el-input
            v-model="searchQuery"
            placeholder="搜索服务器..."
            :prefix-icon="Search"
            clearable
            style="width: 200px"
            @keyup.enter="loadServers"
          />
        </div>
      </template>

      <div class="servers-grid" v-if="servers.length > 0">
        <div
          v-for="server in servers"
          :key="server.id"
          class="server-card"
          :class="{ offline: !server.isOnline, disabled: !server.enabled }"
        >
          <div class="server-header">
            <div class="server-status" :class="server.isOnline ? 'online' : 'offline'">
              {{ server.isOnline ? '🟢' : '🔴' }}
            </div>
            <div class="server-info">
              <div class="server-name">{{ server.name }}</div>
              <div class="server-type">{{ server.type || 'stdio' }}</div>
            </div>
            <el-dropdown trigger="click">
              <el-button text>
                <el-icon><MoreFilled /></el-icon>
              </el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item @click="showConfigDialog(server)">
                    <el-icon><Setting /></el-icon>
                    配置
                  </el-dropdown-item>
                  <el-dropdown-item @click="showToolsDialog(server)">
                    <el-icon><Tools /></el-icon>
                    查看工具
                  </el-dropdown-item>
                  <el-dropdown-item @click="testConnection(server)">
                    <el-icon><Connection /></el-icon>
                    测试连接
                  </el-dropdown-item>
                  <el-dropdown-item divided @click="handleDelete(server)">
                    <el-icon color="#f56c6c"><Delete /></el-icon>
                    删除
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
          
          <div class="server-body">
            <div class="server-meta">
              <div class="meta-item">
                <span class="meta-label">命令</span>
                <span class="meta-value">{{ server.command || '-' }}</span>
              </div>
              <div class="meta-item" v-if="server.url">
                <span class="meta-label">URL</span>
                <span class="meta-value">{{ server.url }}</span>
              </div>
            </div>
            
            <div class="server-tools" v-if="server.tools && server.tools.length > 0">
              <span class="tools-label">工具:</span>
              <div class="tools-list">
                <el-tag
                  v-for="tool in server.tools.slice(0, 3)"
                  :key="tool"
                  size="small"
                  type="info"
                >
                  {{ tool }}
                </el-tag>
                <el-tag v-if="server.tools.length > 3" size="small">
                  +{{ server.tools.length - 3 }}
                </el-tag>
              </div>
            </div>
          </div>
          
          <div class="server-footer">
            <el-switch
              v-model="server.enabled"
              @change="handleToggle(server)"
              active-color="#C41E3A"
            />
            <span class="status-text">{{ server.enabled ? '已启用' : '已禁用' }}</span>
          </div>
        </div>
      </div>
      
      <el-empty v-else description="暂无 MCP 服务器" :image-size="100" />
    </el-card>

    <!-- 添加服务器对话框 -->
    <el-dialog v-model="addDialogVisible" title="添加 MCP 服务器" width="600px">
      <el-form :model="addForm" label-width="100px">
        <el-form-item label="服务器名称" required>
          <el-input v-model="addForm.name" placeholder="输入服务器名称" />
        </el-form-item>
        <el-form-item label="服务器 ID" required>
          <el-input v-model="addForm.id" placeholder="唯一标识，如 my-mcp-server" />
        </el-form-item>
        <el-form-item label="类型">
          <el-radio-group v-model="addForm.type">
            <el-radio value="stdio">stdio (本地)</el-radio>
            <el-radio value="http">HTTP (远程)</el-radio>
          </el-radio-group>
        </el-form-item>
        
        <template v-if="addForm.type === 'stdio'">
          <el-form-item label="命令" required>
            <el-input v-model="addForm.command" placeholder="如 npx -y @modelcontextprotocol/server-filesystem" />
          </el-form-item>
          <el-form-item label="参数">
            <el-input v-model="addForm.args" placeholder="参数，逗号分隔" />
          </el-form-item>
          <el-form-item label="环境变量">
            <el-input
              v-model="addForm.env"
              type="textarea"
              :rows="3"
              placeholder="JSON 格式，如 {&quot;API_KEY&quot;: &quot;xxx&quot;}"
            />
          </el-form-item>
        </template>
        
        <template v-else>
          <el-form-item label="URL" required>
            <el-input v-model="addForm.url" placeholder="http://localhost:3000/mcp" />
          </el-form-item>
          <el-form-item label="认证头">
            <el-input v-model="addForm.authHeader" placeholder="可选，如 Bearer token" />
          </el-form-item>
        </template>
        
        <el-form-item label="描述">
          <el-input v-model="addForm.description" type="textarea" :rows="2" placeholder="服务器描述" />
        </el-form-item>
        
        <el-form-item label="自动启动">
          <el-switch v-model="addForm.autoStart" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="addDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleAdd" :loading="adding">添加</el-button>
      </template>
    </el-dialog>

    <!-- 配置对话框 -->
    <el-dialog v-model="configDialogVisible" title="服务器配置" width="500px">
      <template v-if="currentServer">
        <el-descriptions :column="1" border>
          <el-descriptions-item label="服务器名称">{{ currentServer.name }}</el-descriptions-item>
          <el-descriptions-item label="服务器 ID">{{ currentServer.id }}</el-descriptions-item>
          <el-descriptions-item label="类型">{{ currentServer.type }}</el-descriptions-item>
          <el-descriptions-item label="命令">{{ currentServer.command || '-' }}</el-descriptions-item>
          <el-descriptions-item label="URL">{{ currentServer.url || '-' }}</el-descriptions-item>
        </el-descriptions>
        
        <el-divider content-position="left">高级配置</el-divider>
        <el-form :model="configForm" label-width="100px">
          <el-form-item label="超时时间">
            <el-input-number v-model="configForm.timeout" :min="1000" :max="60000" :step="1000" />
            <span class="unit">ms</span>
          </el-form-item>
          <el-form-item label="重试次数">
            <el-input-number v-model="configForm.retries" :min="0" :max="10" />
          </el-form-item>
          <el-form-item label="自动重启">
            <el-switch v-model="configForm.autoRestart" />
          </el-form-item>
        </el-form>
      </template>
      <template #footer>
        <el-button @click="configDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveConfig" :loading="saving">保存</el-button>
      </template>
    </el-dialog>

    <!-- 工具列表对话框 -->
    <el-dialog v-model="toolsDialogVisible" title="MCP 工具列表" width="700px">
      <template v-if="currentServer">
        <div class="tools-header">
          <span>服务器: {{ currentServer.name }}</span>
          <el-button size="small" @click="loadServerTools" :loading="loadingTools">
            <el-icon><Refresh /></el-icon>
            刷新
          </el-button>
        </div>
        <el-table :data="serverTools" v-loading="loadingTools" stripe max-height="400">
          <el-table-column prop="name" label="工具名称" min-width="150" />
          <el-table-column prop="description" label="描述" min-width="200" />
          <el-table-column prop="inputSchema" label="参数" width="100">
            <template #default="{ row }">
              <el-button size="small" text @click="showSchemaDialog(row)">查看</el-button>
            </template>
          </el-table-column>
        </el-table>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Search, Refresh, Plus, Setting, Tools, Connection, Delete, MoreFilled } from '@element-plus/icons-vue';
import adminApi from '@/api/admin';

const loading = ref(false);
const saving = ref(false);
const adding = ref(false);
const loadingTools = ref(false);

// 数据
const servers = ref([]);
const searchQuery = ref('');

// 统计
const stats = reactive({
  total: 0,
  online: 0,
  offline: 0,
  tools: 0
});

// 添加对话框
const addDialogVisible = ref(false);
const addForm = reactive({
  name: '',
  id: '',
  type: 'stdio',
  command: '',
  args: '',
  env: '',
  url: '',
  authHeader: '',
  description: '',
  autoStart: true
});

// 配置对话框
const configDialogVisible = ref(false);
const currentServer = ref(null);
const configForm = reactive({
  timeout: 30000,
  retries: 3,
  autoRestart: true
});

// 工具对话框
const toolsDialogVisible = ref(false);
const serverTools = ref([]);

// 加载数据
async function loadData() {
  loading.value = true;
  try {
    await Promise.all([loadServers(), loadStats()]);
  } finally {
    loading.value = false;
  }
}

// 加载服务器列表
async function loadServers() {
  try {
    const res = await adminApi.getMCPServers({ search: searchQuery.value });
    if (res.success) {
      servers.value = res.servers || res.data || [];
    }
  } catch (error) {
    console.error('加载服务器失败:', error);
    ElMessage.error('加载服务器列表失败');
  }
}

// 加载统计
async function loadStats() {
  try {
    const res = await adminApi.getStatistics({ type: 'mcp' });
    if (res.success) {
      Object.assign(stats, res.data || res);
    }
  } catch (error) {
    console.error('加载统计失败:', error);
  }
}

// 显示添加对话框
function showAddDialog() {
  Object.assign(addForm, {
    name: '',
    id: '',
    type: 'stdio',
    command: '',
    args: '',
    env: '',
    url: '',
    authHeader: '',
    description: '',
    autoStart: true
  });
  addDialogVisible.value = true;
}

// 添加服务器
async function handleAdd() {
  if (!addForm.name || !addForm.id) {
    ElMessage.warning('请填写必填项');
    return;
  }
  
  adding.value = true;
  try {
    const data = {
      name: addForm.name,
      id: addForm.id,
      type: addForm.type,
      description: addForm.description,
      autoStart: addForm.autoStart
    };
    
    if (addForm.type === 'stdio') {
      data.command = addForm.command;
      data.args = addForm.args ? addForm.args.split(',').map(s => s.trim()) : [];
      if (addForm.env) {
        try {
          data.env = JSON.parse(addForm.env);
        } catch (e) {
          ElMessage.error('环境变量 JSON 格式错误');
          return;
        }
      }
    } else {
      data.url = addForm.url;
      data.authHeader = addForm.authHeader;
    }
    
    const res = await adminApi.addMCPServer(data);
    if (res.success) {
      ElMessage.success('服务器添加成功');
      addDialogVisible.value = false;
      loadData();
    } else {
      ElMessage.error(res.error || '添加失败');
    }
  } catch (error) {
    ElMessage.error('添加失败');
  } finally {
    adding.value = false;
  }
}

// 切换启用状态
async function handleToggle(server) {
  try {
    const res = await adminApi.toggleMCPServer(server.id, server.enabled);
    if (res.success) {
      ElMessage.success(server.enabled ? '已启用' : '已禁用');
    } else {
      server.enabled = !server.enabled;
      ElMessage.error(res.error || '操作失败');
    }
  } catch (error) {
    server.enabled = !server.enabled;
    ElMessage.error('操作失败');
  }
}

// 显示配置对话框
function showConfigDialog(server) {
  currentServer.value = server;
  Object.assign(configForm, server.config || {
    timeout: 30000,
    retries: 3,
    autoRestart: true
  });
  configDialogVisible.value = true;
}

// 保存配置
async function saveConfig() {
  if (!currentServer.value) return;
  
  saving.value = true;
  try {
    const res = await adminApi.updateMCPServer(currentServer.value.id, { config: configForm });
    if (res.success) {
      ElMessage.success('配置已保存');
      configDialogVisible.value = false;
    } else {
      ElMessage.error(res.error || '保存失败');
    }
  } finally {
    saving.value = false;
  }
}

// 显示工具列表
async function showToolsDialog(server) {
  currentServer.value = server;
  toolsDialogVisible.value = true;
  await loadServerTools();
}

// 加载服务器工具
async function loadServerTools() {
  if (!currentServer.value) return;
  
  loadingTools.value = true;
  try {
    const res = await adminApi.getMCPTools(currentServer.value.id);
    if (res.success) {
      serverTools.value = res.tools || res.data || [];
    }
  } catch (error) {
    ElMessage.error('加载工具列表失败');
  } finally {
    loadingTools.value = false;
  }
}

// 测试连接
async function testConnection(server) {
  ElMessage.info('正在测试连接...');
  try {
    const res = await adminApi.getMCPStatus(server.id);
    if (res.success && res.isOnline) {
      ElMessage.success('连接正常');
    } else {
      ElMessage.error('连接失败');
    }
  } catch (error) {
    ElMessage.error('连接测试失败');
  }
}

// 删除服务器
async function handleDelete(server) {
  try {
    await ElMessageBox.confirm(
      `确定删除服务器 "${server.name}" 吗？`,
      '删除服务器',
      { type: 'warning' }
    );
    
    const res = await adminApi.deleteMCPServer(server.id);
    if (res.success) {
      ElMessage.success('已删除');
      loadData();
    } else {
      ElMessage.error(res.error || '删除失败');
    }
  } catch (e) {
    // 取消
  }
}

// 显示 Schema 对话框
function showSchemaDialog(tool) {
  ElMessageBox.alert(
    `<pre style="max-height: 300px; overflow: auto;">${JSON.stringify(tool.inputSchema || {}, null, 2)}</pre>`,
    `${tool.name} 参数 Schema`,
    {
      dangerouslyUseHTMLString: true,
      confirmButtonText: '关闭'
    }
  );
}

onMounted(loadData);
</script>

<style scoped>
.admin-mcp { padding: 0; }

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.page-header h2 {
  margin: 0;
  font-size: 22px;
  font-weight: 600;
}

.header-actions {
  display: flex;
  gap: 12px;
}

/* 统计卡片 */
.stats-cards {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 20px;
}

.stat-card {
  background: white;
  border-radius: 12px;
  padding: 20px;
  display: flex;
  align-items: center;
  gap: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.stat-icon { font-size: 36px; }
.stat-value { font-size: 28px; font-weight: 700; color: #303133; }
.stat-label { font-size: 14px; color: #909399; }

/* 服务器卡片 */
.servers-card { margin-bottom: 20px; }
.card-header { display: flex; justify-content: space-between; align-items: center; }

.servers-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px;
}

.server-card {
  background: #fafafa;
  border-radius: 12px;
  padding: 16px;
  border: 1px solid #e4e7ed;
  transition: all 0.3s;
}

.server-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.server-card.offline {
  opacity: 0.7;
}

.server-card.disabled {
  background: #f5f5f5;
}

.server-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.server-status { font-size: 20px; }
.server-info { flex: 1; }
.server-name { font-weight: 600; font-size: 15px; }
.server-type { font-size: 12px; color: #909399; }

.server-body { margin-bottom: 12px; }
.server-meta { margin-bottom: 8px; }
.meta-item { display: flex; font-size: 13px; margin-bottom: 4px; }
.meta-label { width: 50px; color: #909399; }
.meta-value { flex: 1; color: #606266; word-break: break-all; }

.server-tools { display: flex; align-items: center; gap: 8px; }
.tools-label { font-size: 13px; color: #909399; }
.tools-list { display: flex; gap: 4px; flex-wrap: wrap; }

.server-footer {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-top: 12px;
  border-top: 1px solid #e4e7ed;
}

.status-text { font-size: 13px; color: #909399; }

/* 单位 */
.unit { margin-left: 8px; color: #909399; font-size: 13px; }

/* 工具对话框 */
.tools-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

/* 响应式 */
@media (max-width: 768px) {
  .stats-cards {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .servers-grid {
    grid-template-columns: 1fr;
  }
}
</style>
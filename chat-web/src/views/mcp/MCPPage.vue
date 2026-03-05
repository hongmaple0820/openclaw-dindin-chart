<template>
  <div class="mcp-page">
    <el-tabs v-model="activeTab" class="mcp-tabs">
      <!-- 内置 MCP -->
      <el-tab-pane label="内置 MCP" name="builtin">
        <div class="mcp-grid">
          <div v-for="mcp in builtinMCPs" :key="mcp.id" class="mcp-card builtin">
            <div class="mcp-icon">🔌</div>
            <div class="mcp-info">
              <h4>{{ mcp.display_name || mcp.name }}</h4>
              <p class="mcp-desc">{{ mcp.description }}</p>
              <el-tag size="small">{{ mcp.transport_type }}</el-tag>
            </div>
            <el-button type="primary" size="small" @click="callMCP(mcp)">
              调用
            </el-button>
          </div>
        </div>
      </el-tab-pane>

      <!-- MCP 市场 -->
      <el-tab-pane label="MCP 市场" name="market">
        <div class="market-header">
          <el-input v-model="searchQuery" placeholder="搜索 MCP..." prefix-icon="Search" clearable />
          <el-button type="primary" @click="showSubmitDialog = true">提交 MCP</el-button>
        </div>
        <div class="mcp-grid">
          <div v-for="mcp in marketMCPs" :key="mcp.id" class="mcp-card market">
            <div class="mcp-icon">🔌</div>
            <div class="mcp-info">
              <h4>{{ mcp.display_name || mcp.name }}</h4>
              <p class="mcp-desc">{{ mcp.description }}</p>
              <div class="mcp-stats">
                <span>📥 {{ mcp.downloads || 0 }}</span>
                <span>⭐ {{ mcp.rating?.toFixed(1) || 'N/A' }}</span>
              </div>
            </div>
            <el-button type="primary" size="small" @click="installMCP(mcp)" :loading="mcp.installing">
              安装
            </el-button>
          </div>
        </div>
      </el-tab-pane>

      <!-- 我的 MCP -->
      <el-tab-pane label="我的 MCP" name="mine">
        <div class="mine-header">
          <el-button type="primary" @click="showCreateDialog = true">创建 MCP</el-button>
        </div>
        <el-divider content-position="left">已安装</el-divider>
        <div class="mcp-grid">
          <div v-for="mcp in installedMCPs" :key="mcp.id" class="mcp-card installed">
            <div class="mcp-icon">🔌</div>
            <div class="mcp-info">
              <h4>{{ mcp.mcp_name || mcp.mcp_id }}</h4>
            </div>
            <el-button size="small" type="danger" @click="uninstallMCP(mcp)">卸载</el-button>
          </div>
        </div>
        <el-divider content-position="left">我创建的</el-divider>
        <div class="mcp-grid">
          <div v-for="mcp in customMCPs" :key="mcp.id" class="mcp-card custom">
            <div class="mcp-icon">✏️</div>
            <div class="mcp-info">
              <h4>{{ mcp.display_name || mcp.name }}</h4>
              <el-tag size="small" :type="mcp.publish_status === 'published' ? 'success' : 'info'">
                {{ mcp.publish_status === 'published' ? '已发布' : '未发布' }}
              </el-tag>
            </div>
            <div class="mcp-actions">
              <el-button size="small" @click="editMCP(mcp)">编辑</el-button>
              <el-button size="small" type="danger" @click="deleteMCP(mcp)">删除</el-button>
            </div>
          </div>
        </div>
      </el-tab-pane>

      <!-- 外部市场 -->
      <el-tab-pane label="外部市场" name="external">
        <div class="external-markets">
          <div v-for="market in externalMarkets" :key="market.id" class="market-card">
            <div class="market-icon">🌐</div>
            <div class="market-info">
              <h4>{{ market.display_name }}</h4>
              <p>{{ market.description }}</p>
            </div>
            <el-button type="primary" @click="openExternal(market.url)">打开 →</el-button>
          </div>
        </div>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'

const activeTab = ref('builtin')
const searchQuery = ref('')
const showCreateDialog = ref(false)
const showSubmitDialog = ref(false)

const builtinMCPs = ref([])
const marketMCPs = ref([])
const installedMCPs = ref([])
const customMCPs = ref([])
const externalMarkets = ref([])

const API_BASE = 'http://localhost:8273/api'

async function loadBuiltinMCPs() {
  try {
    const res = await fetch(`${API_BASE}/mcp/v2/builtin`)
    const data = await res.json()
    if (data.success) builtinMCPs.value = data.data
  } catch (e) {
    console.error('加载内置 MCP 失败:', e)
  }
}

async function loadMarketMCPs() {
  try {
    const res = await fetch(`${API_BASE}/mcp/v2/market`)
    const data = await res.json()
    if (data.success) marketMCPs.value = data.data
  } catch (e) {
    console.error('加载 MCP 市场失败:', e)
  }
}

async function loadMyMCPs() {
  try {
    const res = await fetch(`${API_BASE}/mcp/v2/mine`)
    const data = await res.json()
    if (data.success) {
      installedMCPs.value = data.data.installed || []
      customMCPs.value = data.data.custom || []
    }
  } catch (e) {
    console.error('加载我的 MCP 失败:', e)
  }
}

async function loadExternalMarkets() {
  try {
    const res = await fetch(`${API_BASE}/mcp/v2/external`)
    const data = await res.json()
    if (data.success) {
      externalMarkets.value = data.data
    }
  } catch (e) {
    externalMarkets.value = [
      { id: 'clawhub', display_name: 'ClawHub', description: 'OpenClaw 官方技能市场', url: 'https://clawhub.com' },
      { id: 'mcp-cn', display_name: 'MCP中文站', description: 'MCP 服务器发现平台', url: 'https://mcp-cn.com' }
    ]
  }
}

async function installMCP(mcp) {
  mcp.installing = true
  try {
    const res = await fetch(`${API_BASE}/mcp/v2/market/${mcp.id}/install`, { method: 'POST' })
    const data = await res.json()
    if (data.success) {
      ElMessage.success('安装成功')
      loadMyMCPs()
    } else {
      ElMessage.error(data.error || '安装失败')
    }
  } catch (e) {
    ElMessage.error('安装失败')
  } finally {
    mcp.installing = false
  }
}

function callMCP(mcp) {
  ElMessage.info(`调用 MCP: ${mcp.name}`)
}

function uninstallMCP(mcp) {
  ElMessage.info(`卸载 MCP: ${mcp.mcp_name}`)
}

function editMCP(mcp) {
  ElMessage.info(`编辑 MCP: ${mcp.name}`)
}

function deleteMCP(mcp) {
  ElMessage.info(`删除 MCP: ${mcp.name}`)
}

function openExternal(url) {
  window.open(url, '_blank')
}

onMounted(() => {
  loadBuiltinMCPs()
  loadMarketMCPs()
  loadMyMCPs()
  loadExternalMarkets()
})
</script>

<style scoped>
.mcp-page { padding: 20px; }
.mcp-tabs { background: white; border-radius: 8px; padding: 20px; }
.mcp-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px; margin-top: 16px; }
.mcp-card { display: flex; align-items: center; padding: 16px; background: #f8f9fa; border-radius: 8px; border: 1px solid #e9ecef; }
.mcp-card.builtin { border-left: 3px solid #409eff; }
.mcp-card.market { border-left: 3px solid #67c23a; }
.mcp-card.installed { border-left: 3px solid #909399; }
.mcp-card.custom { border-left: 3px solid #e6a23c; }
.mcp-icon { font-size: 32px; margin-right: 16px; }
.mcp-info { flex: 1; }
.mcp-info h4 { margin: 0 0 4px 0; font-size: 16px; }
.mcp-desc { margin: 0; font-size: 12px; color: #909399; }
.mcp-stats { margin-top: 8px; font-size: 12px; color: #606266; }
.mcp-stats span { margin-right: 12px; }
.mcp-actions { display: flex; gap: 8px; }
.market-header, .mine-header { display: flex; gap: 16px; margin-bottom: 16px; }
.market-header .el-input { max-width: 300px; }
.external-markets { display: grid; gap: 16px; margin-top: 16px; }
.market-card { display: flex; align-items: center; padding: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px; color: white; }
.market-icon { font-size: 40px; margin-right: 20px; }
.market-info { flex: 1; }
.market-info h4 { margin: 0 0 8px 0; font-size: 18px; }
.market-info p { margin: 0; opacity: 0.9; }
</style>
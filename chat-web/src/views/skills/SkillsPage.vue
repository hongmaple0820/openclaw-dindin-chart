<template>
  <div class="skills-page">
    <!-- 标签页 -->
    <el-tabs v-model="activeTab" class="skills-tabs">
      <!-- 内置技能 -->
      <el-tab-pane label="内置技能" name="builtin">
        <div class="skills-grid">
          <div 
            v-for="skill in builtinSkills" 
            :key="skill.id" 
            class="skill-card builtin"
          >
            <div class="skill-icon">{{ skill.icon || '⚡' }}</div>
            <div class="skill-info">
              <h4>{{ skill.display_name || skill.name }}</h4>
              <p class="skill-desc">{{ skill.description }}</p>
              <span class="skill-tag">{{ skill.category }}</span>
            </div>
            <el-button type="primary" size="small" @click="useSkill(skill)">
              使用
            </el-button>
          </div>
        </div>
      </el-tab-pane>

      <!-- 云市场 -->
      <el-tab-pane label="云市场" name="market">
        <div class="market-header">
          <el-input 
            v-model="searchQuery" 
            placeholder="搜索技能..." 
            prefix-icon="Search"
            clearable
            @input="searchSkills"
          />
          <el-button type="primary" @click="showSubmitDialog = true">
            提交技能
          </el-button>
        </div>
        
        <div class="skills-grid">
          <div 
            v-for="skill in marketSkills" 
            :key="skill.id" 
            class="skill-card market"
          >
            <div class="skill-icon">{{ skill.icon || '📦' }}</div>
            <div class="skill-info">
              <h4>{{ skill.display_name || skill.name }}</h4>
              <p class="skill-desc">{{ skill.description }}</p>
              <div class="skill-stats">
                <span>⭐ {{ skill.rating?.toFixed(1) || 'N/A' }}</span>
                <span>📥 {{ skill.downloads || 0 }}</span>
              </div>
            </div>
            <el-button 
              type="primary" 
              size="small" 
              @click="installSkill(skill)"
              :loading="skill.installing"
            >
              安装
            </el-button>
          </div>
        </div>
      </el-tab-pane>

      <!-- 我的技能 -->
      <el-tab-pane label="我的技能" name="mine">
        <div class="mine-header">
          <el-button type="primary" @click="showCreateDialog = true">
            创建技能
          </el-button>
        </div>
        
        <el-divider content-position="left">已安装</el-divider>
        <div class="skills-grid">
          <div 
            v-for="skill in installedSkills" 
            :key="skill.id" 
            class="skill-card installed"
          >
            <div class="skill-icon">📦</div>
            <div class="skill-info">
              <h4>{{ skill.skill_name || skill.id }}</h4>
              <p class="skill-desc">安装于: {{ formatDate(skill.installed_at) }}</p>
            </div>
            <div class="skill-actions">
              <el-button size="small" @click="useSkill(skill)">使用</el-button>
              <el-button size="small" type="danger" @click="uninstallSkill(skill)">
                卸载
              </el-button>
            </div>
          </div>
        </div>

        <el-divider content-position="left">我创建的</el-divider>
        <div class="skills-grid">
          <div 
            v-for="skill in customSkills" 
            :key="skill.id" 
            class="skill-card custom"
          >
            <div class="skill-icon">✏️</div>
            <div class="skill-info">
              <h4>{{ skill.display_name || skill.name }}</h4>
              <p class="skill-desc">{{ skill.description }}</p>
              <el-tag size="small" :type="skill.publish_status === 'published' ? 'success' : 'info'">
                {{ skill.publish_status === 'published' ? '已发布' : '未发布' }}
              </el-tag>
            </div>
            <div class="skill-actions">
              <el-button size="small" @click="editSkill(skill)">编辑</el-button>
              <el-button size="small" type="success" @click="publishSkill(skill)">
                发布
              </el-button>
              <el-button size="small" type="danger" @click="deleteSkill(skill)">
                删除
              </el-button>
            </div>
          </div>
        </div>
      </el-tab-pane>

      <!-- 外部市场 -->
      <el-tab-pane label="外部市场" name="external">
        <div class="external-markets">
          <div 
            v-for="market in externalMarkets" 
            :key="market.id" 
            class="market-card"
          >
            <div class="market-icon">🌐</div>
            <div class="market-info">
              <h4>{{ market.display_name }}</h4>
              <p>{{ market.description }}</p>
            </div>
            <el-button type="primary" @click="openExternal(market.url)">
              打开 →
            </el-button>
          </div>
        </div>
      </el-tab-pane>
    </el-tabs>

    <!-- 创建技能对话框 -->
    <el-dialog v-model="showCreateDialog" title="创建技能" width="600px">
      <el-form :model="newSkill" label-width="100px">
        <el-form-item label="名称" required>
          <el-input v-model="newSkill.name" placeholder="技能名称" />
        </el-form-item>
        <el-form-item label="显示名称">
          <el-input v-model="newSkill.display_name" placeholder="显示名称" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="newSkill.description" type="textarea" rows="3" />
        </el-form-item>
        <el-form-item label="分类">
          <el-select v-model="newSkill.category" placeholder="选择分类">
            <el-option label="通用" value="general" />
            <el-option label="开发" value="development" />
            <el-option label="效率" value="productivity" />
            <el-option label="通讯" value="communication" />
            <el-option label="多媒体" value="multimedia" />
          </el-select>
        </el-form-item>
        <el-form-item label="技能内容">
          <el-input 
            v-model="newSkill.skill_content" 
            type="textarea" 
            rows="10" 
            placeholder="SKILL.md 内容..."
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreateDialog = false">取消</el-button>
        <el-button type="primary" @click="createSkill">创建</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'

const activeTab = ref('builtin')
const searchQuery = ref('')
const showCreateDialog = ref(false)
const showSubmitDialog = ref(false)

const builtinSkills = ref([])
const marketSkills = ref([])
const installedSkills = ref([])
const customSkills = ref([])
const externalMarkets = ref([])

const newSkill = ref({
  name: '',
  display_name: '',
  description: '',
  category: 'general',
  skill_content: ''
})

const API_BASE = 'http://localhost:8273/api'

// 加载内置技能
async function loadBuiltinSkills() {
  try {
    const res = await fetch(`${API_BASE}/skills/v2/builtin`)
    const data = await res.json()
    if (data.success) {
      builtinSkills.value = data.data
    }
  } catch (e) {
    console.error('加载内置技能失败:', e)
  }
}

// 加载云市场技能
async function loadMarketSkills() {
  try {
    const res = await fetch(`${API_BASE}/skills/v2/market`)
    const data = await res.json()
    if (data.success) {
      marketSkills.value = data.data
    }
  } catch (e) {
    console.error('加载云市场失败:', e)
  }
}

// 加载我的技能
async function loadMySkills() {
  try {
    const res = await fetch(`${API_BASE}/skills/v2/mine`)
    const data = await res.json()
    if (data.success) {
      installedSkills.value = data.data.installed || []
      customSkills.value = data.data.custom || []
    }
  } catch (e) {
    console.error('加载我的技能失败:', e)
  }
}

// 加载外部市场
async function loadExternalMarkets() {
  try {
    const res = await fetch(`${API_BASE}/mcp/v2/external`)
    const data = await res.json()
    if (data.success) {
      externalMarkets.value = data.data
    }
  } catch (e) {
    // 使用默认数据
    externalMarkets.value = [
      { id: 'clawhub', display_name: 'ClawHub', description: 'OpenClaw 官方技能市场', url: 'https://clawhub.com' },
      { id: 'mcp-cn', display_name: 'MCP中文站', description: 'MCP 服务器发现平台', url: 'https://mcp-cn.com' },
      { id: 'skills-sh', display_name: 'skills.sh', description: '热门技能排行', url: 'https://skills.sh' }
    ]
  }
}

// 安装技能
async function installSkill(skill) {
  skill.installing = true
  try {
    const res = await fetch(`${API_BASE}/skills/v2/market/${skill.id}/install`, {
      method: 'POST'
    })
    const data = await res.json()
    if (data.success) {
      ElMessage.success('安装成功')
      loadMySkills()
    } else {
      ElMessage.error(data.error || '安装失败')
    }
  } catch (e) {
    ElMessage.error('安装失败')
  } finally {
    skill.installing = false
  }
}

// 创建技能
async function createSkill() {
  try {
    const res = await fetch(`${API_BASE}/skills/v2/mine`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newSkill.value)
    })
    const data = await res.json()
    if (data.success) {
      ElMessage.success('创建成功')
      showCreateDialog.value = false
      loadMySkills()
      newSkill.value = { name: '', display_name: '', description: '', category: 'general', skill_content: '' }
    } else {
      ElMessage.error(data.error || '创建失败')
    }
  } catch (e) {
    ElMessage.error('创建失败')
  }
}

// 打开外部市场
function openExternal(url) {
  window.open(url, '_blank')
}

// 格式化日期
function formatDate(timestamp) {
  if (!timestamp) return 'N/A'
  return new Date(timestamp).toLocaleDateString()
}

// 使用技能
function useSkill(skill) {
  ElMessage.info(`使用技能: ${skill.name}`)
}

// 卸载技能
function uninstallSkill(skill) {
  ElMessage.info(`卸载技能: ${skill.name}`)
}

// 编辑技能
function editSkill(skill) {
  ElMessage.info(`编辑技能: ${skill.name}`)
}

// 发布技能
function publishSkill(skill) {
  ElMessage.info(`发布技能: ${skill.name}`)
}

// 删除技能
function deleteSkill(skill) {
  ElMessage.info(`删除技能: ${skill.name}`)
}

// 搜索技能
function searchSkills() {
  loadMarketSkills()
}

onMounted(() => {
  loadBuiltinSkills()
  loadMarketSkills()
  loadMySkills()
  loadExternalMarkets()
})
</script>

<style scoped>
.skills-page {
  padding: 20px;
}

.skills-tabs {
  background: white;
  border-radius: 8px;
  padding: 20px;
}

.skills-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
  margin-top: 16px;
}

.skill-card {
  display: flex;
  align-items: center;
  padding: 16px;
  background: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #e9ecef;
}

.skill-card.builtin {
  border-left: 3px solid #409eff;
}

.skill-card.market {
  border-left: 3px solid #67c23a;
}

.skill-card.installed {
  border-left: 3px solid #909399;
}

.skill-card.custom {
  border-left: 3px solid #e6a23c;
}

.skill-icon {
  font-size: 32px;
  margin-right: 16px;
}

.skill-info {
  flex: 1;
}

.skill-info h4 {
  margin: 0 0 4px 0;
  font-size: 16px;
}

.skill-desc {
  margin: 0;
  font-size: 12px;
  color: #909399;
}

.skill-stats {
  margin-top: 8px;
  font-size: 12px;
  color: #606266;
}

.skill-stats span {
  margin-right: 12px;
}

.skill-tag {
  font-size: 11px;
  color: #909399;
}

.skill-actions {
  display: flex;
  gap: 8px;
}

.market-header,
.mine-header {
  display: flex;
  gap: 16px;
  margin-bottom: 16px;
}

.market-header .el-input {
  max-width: 300px;
}

.external-markets {
  display: grid;
  gap: 16px;
  margin-top: 16px;
}

.market-card {
  display: flex;
  align-items: center;
  padding: 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 12px;
  color: white;
}

.market-icon {
  font-size: 40px;
  margin-right: 20px;
}

.market-info {
  flex: 1;
}

.market-info h4 {
  margin: 0 0 8px 0;
  font-size: 18px;
}

.market-info p {
  margin: 0;
  opacity: 0.9;
}
</style>
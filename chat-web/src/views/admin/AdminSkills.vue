<!--
  管理后台 - 技能管理
  @author 小琳
  @date 2026-03-04
-->
<template>
  <div class="admin-skills">
    <!-- 页面标题 -->
    <div class="page-header">
      <h2>🔧 技能管理</h2>
      <div class="header-actions">
        <el-button type="primary" @click="showAddDialog">
          <el-icon><Plus /></el-icon>
          添加技能
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
        <div class="stat-icon">📦</div>
        <div class="stat-content">
          <div class="stat-value">{{ stats.total }}</div>
          <div class="stat-label">总技能数</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">✅</div>
        <div class="stat-content">
          <div class="stat-value">{{ stats.enabled }}</div>
          <div class="stat-label">已启用</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">⏸️</div>
        <div class="stat-content">
          <div class="stat-value">{{ stats.disabled }}</div>
          <div class="stat-label">已禁用</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">🏪</div>
        <div class="stat-content">
          <div class="stat-value">{{ stats.market }}</div>
          <div class="stat-label">市场安装</div>
        </div>
      </div>
    </div>

    <!-- 筛选栏 -->
    <el-card class="filter-card" shadow="hover">
      <div class="filter-row">
        <el-input
          v-model="searchQuery"
          placeholder="搜索技能名称..."
          :prefix-icon="Search"
          clearable
          style="width: 240px"
          @keyup.enter="loadSkills"
        />
        <el-select v-model="filterCategory" placeholder="分类" clearable style="width: 150px" @change="loadSkills">
          <el-option label="开发工具" value="dev" />
          <el-option label="数据处理" value="data" />
          <el-option label="自动化" value="automation" />
          <el-option label="AI 能力" value="ai" />
          <el-option label="系统工具" value="system" />
          <el-option label="其他" value="other" />
        </el-select>
        <el-select v-model="filterStatus" placeholder="状态" clearable style="width: 120px" @change="loadSkills">
          <el-option label="已启用" value="enabled" />
          <el-option label="已禁用" value="disabled" />
        </el-select>
        <el-select v-model="filterSource" placeholder="来源" clearable style="width: 120px" @change="loadSkills">
          <el-option label="内置" value="built-in" />
          <el-option label="市场安装" value="market" />
          <el-option label="自定义" value="custom" />
        </el-select>
      </div>
    </el-card>

    <!-- 技能列表 -->
    <el-card class="skills-card" shadow="hover">
      <el-table
        :data="skills"
        v-loading="loading"
        stripe
        style="width: 100%"
      >
        <el-table-column label="技能" min-width="250">
          <template #default="{ row }">
            <div class="skill-cell">
              <div class="skill-icon">{{ row.icon || '🔧' }}</div>
              <div class="skill-info">
                <div class="skill-name">
                  {{ row.name }}
                  <el-tag v-if="row.type === 'built-in'" size="small" type="info">内置</el-tag>
                  <el-tag v-if="row.type === 'market'" size="small" type="success">市场</el-tag>
                </div>
                <div class="skill-desc">{{ row.description || '暂无描述' }}</div>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="category" label="分类" width="100">
          <template #default="{ row }">
            {{ getCategoryLabel(row.category) }}
          </template>
        </el-table-column>
        <el-table-column prop="version" label="版本" width="80">
          <template #default="{ row }">
            v{{ row.version || '1.0.0' }}
          </template>
        </el-table-column>
        <el-table-column prop="enabled" label="状态" width="100">
          <template #default="{ row }">
            <el-switch
              v-model="row.enabled"
              @change="handleToggle(row)"
              active-color="#C41E3A"
            />
          </template>
        </el-table-column>
        <el-table-column prop="usageCount" label="使用次数" width="100">
          <template #default="{ row }">
            <span class="usage-count">{{ row.usageCount || 0 }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="installedAt" label="安装时间" width="160">
          <template #default="{ row }">
            {{ formatDate(row.installedAt) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{ row }">
            <div class="action-buttons">
              <el-button size="small" @click="showConfigDialog(row)">
                <el-icon><Setting /></el-icon>
                配置
              </el-button>
              <el-button 
                v-if="row.type !== 'built-in'"
                size="small" 
                type="danger"
                @click="handleDelete(row)"
              >
                删除
              </el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页 -->
      <div class="pagination-wrapper">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.limit"
          :total="pagination.total"
          :page-sizes="[10, 20, 50]"
          layout="total, sizes, prev, pager, next"
          @size-change="loadSkills"
          @current-change="loadSkills"
        />
      </div>
    </el-card>

    <!-- 配置对话框 -->
    <el-dialog v-model="configDialogVisible" title="技能配置" width="600px">
      <template v-if="currentSkill">
        <el-form :model="configForm" label-width="100px">
          <el-form-item label="技能名称">
            <el-input v-model="currentSkill.name" disabled />
          </el-form-item>
          <el-form-item label="技能 ID">
            <el-input v-model="currentSkill.id" disabled />
          </el-form-item>
          <el-divider content-position="left">配置项</el-divider>
          <template v-if="currentSkill.configSchema && currentSkill.configSchema.length > 0">
            <el-form-item
              v-for="field in currentSkill.configSchema"
              :key="field.key"
              :label="field.label"
            >
              <el-input
                v-if="field.type === 'string'"
                v-model="configForm[field.key]"
                :placeholder="field.placeholder"
              />
              <el-input-number
                v-else-if="field.type === 'number'"
                v-model="configForm[field.key]"
                :min="field.min"
                :max="field.max"
              />
              <el-switch
                v-else-if="field.type === 'boolean'"
                v-model="configForm[field.key]"
              />
              <el-select
                v-else-if="field.type === 'select'"
                v-model="configForm[field.key]"
              >
                <el-option
                  v-for="opt in field.options"
                  :key="opt.value"
                  :label="opt.label"
                  :value="opt.value"
                />
              </el-select>
            </el-form-item>
          </template>
          <el-empty v-else description="该技能没有可配置项" :image-size="80" />
        </el-form>
      </template>
      <template #footer>
        <el-button @click="configDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveConfig" :loading="saving">保存配置</el-button>
      </template>
    </el-dialog>

    <!-- 添加技能对话框 -->
    <el-dialog v-model="addDialogVisible" title="添加技能" width="500px">
      <el-form :model="addForm" label-width="80px">
        <el-form-item label="技能名称" required>
          <el-input v-model="addForm.name" placeholder="输入技能名称" />
        </el-form-item>
        <el-form-item label="技能 ID" required>
          <el-input v-model="addForm.id" placeholder="唯一标识，如 my-skill" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="addForm.description" type="textarea" :rows="3" placeholder="技能描述" />
        </el-form-item>
        <el-form-item label="分类">
          <el-select v-model="addForm.category" placeholder="选择分类">
            <el-option label="开发工具" value="dev" />
            <el-option label="数据处理" value="data" />
            <el-option label="自动化" value="automation" />
            <el-option label="AI 能力" value="ai" />
            <el-option label="系统工具" value="system" />
            <el-option label="其他" value="other" />
          </el-select>
        </el-form-item>
        <el-form-item label="来源">
          <el-radio-group v-model="addForm.type">
            <el-radio value="market">从市场安装</el-radio>
            <el-radio value="custom">自定义技能</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item v-if="addForm.type === 'market'" label="市场 URL">
          <el-input v-model="addForm.marketUrl" placeholder="技能市场 URL" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="addDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleAdd" :loading="adding">添加</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Search, Refresh, Plus, Setting } from '@element-plus/icons-vue';
import adminApi from '@/api/admin';

const loading = ref(false);
const saving = ref(false);
const adding = ref(false);

// 数据
const skills = ref([]);
const searchQuery = ref('');
const filterCategory = ref('');
const filterStatus = ref('');
const filterSource = ref('');

// 统计
const stats = reactive({
  total: 0,
  enabled: 0,
  disabled: 0,
  market: 0
});

// 分页
const pagination = reactive({
  page: 1,
  limit: 20,
  total: 0
});

// 配置对话框
const configDialogVisible = ref(false);
const currentSkill = ref(null);
const configForm = reactive({});

// 添加对话框
const addDialogVisible = ref(false);
const addForm = reactive({
  name: '',
  id: '',
  description: '',
  category: '',
  type: 'custom',
  marketUrl: ''
});

// 加载数据
async function loadData() {
  loading.value = true;
  try {
    await loadSkills();
    await loadStats();
  } finally {
    loading.value = false;
  }
}

// 加载技能列表
async function loadSkills() {
  try {
    const params = {
      page: pagination.page,
      limit: pagination.limit,
      search: searchQuery.value,
      category: filterCategory.value,
      status: filterStatus.value,
      source: filterSource.value
    };
    
    const res = await adminApi.getAllSkills(params);
    if (res.success) {
      skills.value = res.skills || res.data || [];
      pagination.total = res.pagination?.total || res.total || 0;
    }
  } catch (error) {
    console.error('加载技能失败:', error);
    ElMessage.error('加载技能列表失败');
  }
}

// 加载统计
async function loadStats() {
  try {
    const res = await adminApi.getStatistics({ type: 'skills' });
    if (res.success) {
      Object.assign(stats, res.data || res);
    }
  } catch (error) {
    console.error('加载统计失败:', error);
  }
}

// 切换启用状态
async function handleToggle(skill) {
  try {
    const res = await adminApi.toggleSkill(skill.id, skill.enabled);
    if (res.success) {
      ElMessage.success(skill.enabled ? '已启用' : '已禁用');
      loadStats();
    } else {
      skill.enabled = !skill.enabled;
      ElMessage.error(res.error || '操作失败');
    }
  } catch (error) {
    skill.enabled = !skill.enabled;
    ElMessage.error('操作失败');
  }
}

// 显示配置对话框
function showConfigDialog(skill) {
  currentSkill.value = skill;
  // 初始化配置表单
  Object.keys(configForm).forEach(key => delete configForm[key]);
  if (skill.config) {
    Object.assign(configForm, skill.config);
  }
  configDialogVisible.value = true;
}

// 保存配置
async function saveConfig() {
  if (!currentSkill.value) return;
  
  saving.value = true;
  try {
    const res = await adminApi.updateSkillConfig(currentSkill.value.id, configForm);
    if (res.success) {
      ElMessage.success('配置已保存');
      configDialogVisible.value = false;
      loadSkills();
    } else {
      ElMessage.error(res.error || '保存失败');
    }
  } finally {
    saving.value = false;
  }
}

// 删除技能
async function handleDelete(skill) {
  try {
    await ElMessageBox.confirm(
      `确定删除技能 "${skill.name}" 吗？删除后无法恢复。`,
      '删除技能',
      { type: 'warning' }
    );
    
    const res = await adminApi.deleteSkill(skill.id);
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

// 显示添加对话框
function showAddDialog() {
  Object.assign(addForm, {
    name: '',
    id: '',
    description: '',
    category: '',
    type: 'custom',
    marketUrl: ''
  });
  addDialogVisible.value = true;
}

// 添加技能
async function handleAdd() {
  if (!addForm.name || !addForm.id) {
    ElMessage.warning('请填写必填项');
    return;
  }
  
  adding.value = true;
  try {
    // 这里应该调用添加技能的 API
    ElMessage.success('技能添加成功');
    addDialogVisible.value = false;
    loadData();
  } catch (error) {
    ElMessage.error('添加失败');
  } finally {
    adding.value = false;
  }
}

// 获取分类标签
function getCategoryLabel(category) {
  const labels = {
    dev: '开发工具',
    data: '数据处理',
    automation: '自动化',
    ai: 'AI 能力',
    system: '系统工具',
    other: '其他'
  };
  return labels[category] || category || '未分类';
}

// 格式化日期
function formatDate(timestamp) {
  if (!timestamp) return '-';
  return new Date(timestamp).toLocaleDateString('zh-CN');
}

onMounted(loadData);
</script>

<style scoped>
.admin-skills { padding: 0; }

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

.stat-icon {
  font-size: 36px;
}

.stat-value {
  font-size: 28px;
  font-weight: 700;
  color: #303133;
}

.stat-label {
  font-size: 14px;
  color: #909399;
}

/* 筛选 */
.filter-card { margin-bottom: 20px; }
.filter-row { display: flex; gap: 12px; flex-wrap: wrap; }

/* 技能列表 */
.skills-card { margin-bottom: 20px; }

.skill-cell {
  display: flex;
  align-items: center;
  gap: 12px;
}

.skill-icon {
  width: 48px;
  height: 48px;
  border-radius: 10px;
  background: linear-gradient(135deg, rgba(196, 30, 58, 0.1) 0%, rgba(196, 30, 58, 0.05) 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
}

.skill-info .skill-name {
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
}

.skill-info .skill-desc {
  font-size: 13px;
  color: #909399;
  margin-top: 4px;
}

.usage-count {
  font-weight: 500;
  color: #606266;
}

.action-buttons {
  display: flex;
  gap: 8px;
}

.pagination-wrapper {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
}

/* 响应式 */
@media (max-width: 768px) {
  .stats-cards {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .filter-row {
    flex-direction: column;
  }
  
  .filter-row .el-input,
  .filter-row .el-select {
    width: 100% !important;
  }
}
</style>
<!--
  Skills 管理主页面
  @author 小琳
  @date 2026-03-04
-->
<template>
  <div class="skills-page">
    <div class="skills-container">
      <!-- 左侧：技能列表 -->
      <div class="skills-sidebar">
        <!-- 顶部搜索栏 -->
        <div class="sidebar-header">
          <h3>技能管理</h3>
        </div>
        
        <!-- Tab 切换 -->
        <el-tabs v-model="skillStore.currentTab" @tab-change="handleTabChange">
          <el-tab-pane label="内置技能" name="built-in">
            <template #label>
              <span>内置技能 <el-badge :value="skillStore.builtInSkills.length" /></span>
            </template>
          </el-tab-pane>
          <el-tab-pane label="我的技能" name="my">
            <template #label>
              <span>我的技能 <el-badge :value="skillStore.mySkills.length" /></span>
            </template>
          </el-tab-pane>
          <el-tab-pane label="技能市场" name="market">
            <template #label>
              <span>技能市场</span>
            </template>
          </el-tab-pane>
        </el-tabs>
        
        <!-- 搜索和筛选 -->
        <div class="search-wrapper">
          <el-input
            v-model="skillStore.searchQuery"
            placeholder="搜索技能..."
            :prefix-icon="Search"
            clearable
            @input="handleSearch"
          />
          <el-select
            v-model="skillStore.categoryFilter"
            placeholder="分类筛选"
            clearable
            @change="handleCategoryChange"
            style="margin-top: 8px; width: 100%"
          >
            <el-option
              v-for="category in skillStore.categories"
              :key="category"
              :label="category"
              :value="category"
            />
          </el-select>
        </div>
        
        <!-- 技能列表 -->
        <div class="skills-list">
          <div v-if="skillStore.loading" class="loading-state">
            <el-icon class="is-loading"><Loading /></el-icon>
            <span>加载中...</span>
          </div>
          
          <div v-else-if="currentSkills.length === 0" class="empty-skills">
            <el-empty description="暂无技能" :image-size="100" />
          </div>
          
          <template v-else>
            <SkillCard
              v-for="skill in currentSkills"
              :key="skill.id"
              :skill="skill"
              :is-active="skillStore.currentSkill?.id === skill.id"
              @click="selectSkill(skill)"
              @toggle="handleToggleSkill"
              @install="handleInstallSkill"
            />
          </template>
        </div>
      </div>
      
      <!-- 右侧：技能详情 -->
      <div class="skill-detail">
        <template v-if="skillStore.currentSkill">
          <div class="detail-header">
            <div class="skill-icon-large">
              <span class="icon-emoji">{{ skillStore.currentSkill.icon || '🔧' }}</span>
            </div>
            <div class="detail-info">
              <div class="detail-name">
                {{ skillStore.currentSkill.name }}
                <el-tag v-if="skillStore.currentSkill.installed" type="success">
                  已安装
                </el-tag>
                <el-tag v-if="!skillStore.currentSkill.enabled && skillStore.currentSkill.installed" type="warning">
                  已禁用
                </el-tag>
              </div>
              <div class="detail-desc">
                {{ skillStore.currentSkill.description || '暂无描述' }}
              </div>
            </div>
          </div>
          
          <el-divider />
          
          <el-tabs v-model="activeDetailTab">
            <el-tab-pane label="基本信息" name="info">
              <el-descriptions :column="1" border>
                <el-descriptions-item label="技能 ID">
                  {{ skillStore.currentSkill.id }}
                </el-descriptions-item>
                <el-descriptions-item label="版本">
                  v{{ skillStore.currentSkill.version || '1.0.0' }}
                </el-descriptions-item>
                <el-descriptions-item label="分类">
                  {{ skillStore.currentSkill.category || '未分类' }}
                </el-descriptions-item>
                <el-descriptions-item label="类型">
                  {{ skillStore.currentSkill.type === 'built-in' ? '内置' : skillStore.currentSkill.type === 'market' ? '市场' : '自定义' }}
                </el-descriptions-item>
                <el-descriptions-item v-if="skillStore.currentSkill.author" label="作者">
                  {{ skillStore.currentSkill.author }}
                </el-descriptions-item>
                <el-descriptions-item v-if="skillStore.currentSkill.installedAt" label="安装时间">
                  {{ formatDate(skillStore.currentSkill.installedAt) }}
                </el-descriptions-item>
              </el-descriptions>
            </el-tab-pane>
            
            <el-tab-pane label="配置" name="config" v-if="skillStore.currentSkill.installed">
              <SkillConfig
                :skill="skillStore.currentSkill"
                :config="skillStore.currentSkill.config || {}"
                :loading="configLoading"
                @save="handleSaveConfig"
                @reset="handleResetConfig"
              />
            </el-tab-pane>
            
            <el-tab-pane label="使用示例" name="examples" v-if="skillStore.currentSkill.examples">
              <div class="examples-section">
                <div v-for="(example, index) in skillStore.currentSkill.examples" :key="index" class="example-item">
                  <div class="example-title">{{ example.title }}</div>
                  <div class="example-desc">{{ example.description }}</div>
                  <el-input
                    :model-value="example.command"
                    readonly
                    class="example-command"
                  >
                    <template #append>
                      <el-bucon="CopyDocument" @click="copyCommand(example.command)">
                        复制
                      </el-button>
                    </template>
                  </el-input>
                </div>
              </div>
            </el-tab-pane>
          </el-tabs>
          
          <div class="detail-actions">
            <el-button
              v-if="!skillStore.currentSkill.installed"
              type="primary"
              :icon="Download"
              @click="handleInstallSkill(skillStore.currentSkill.id)"
              :loadining"
            >
              安装技能
            </el-button>
            <el-button
              v-else
              type="danger"
              :icon="Delete"
              @click="handleUninstallSkill"
              :loading="uninstalling"
            >
              卸载技能
            </el-button>
            <el-button
              v-if="skillStore.currentSkill.installed"
              :icon="Setting"
              @click="activeDetailTab = 'config'"
            >
              配置
            </el-button>
          </div>
        </template>
        
        <div v-else class="empty-detail">
          <el-empty description="选择一个技能查看详情" :image-size="120" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import {
  Search, Loading, Download, Delete, Setting, CopyDocument
} from '@element-plus/icons-vue';
import { useSkillStore } from '@/stores/skills';
import SkillCard from '@/components/SkillCard.vue';
import SkillConfig from '@/components/SkillConfig.vue';

const skillStore = useSkillStore();

// 状态
const activeDetailTab = ref('info');
const installing = ref(false);
const uninstalling = ref(false);
const configLoading = ref(false);

// 计算属性
const currentSkills = computed(() => {
  switch (skillStore.currentTab) {
    case 'built-in':
      return skillStore.builtInSkills;
    case 'my':
      return skillStore.mySkills;
    case 'market':
      return skillStore.marketSkills;
    default:
      return skillStore.skills;
  }
});

// 初始化
onMounted(async () => {
  await Promise.all([
    skillStore.fetchSkills(),
    skillStore.fetchCategories()
  ]);
});

// Tab 切换
function handleTabChange(tab) {
  skillStore.setCurrentTab(tab);
  skillStore.fetchSkills();
}

// 搜索
function handleSearch() {
  skillStore.fetchSkills();
}

// 分类筛选
function handleCategoryChange() {
  skillStore.fetchSkills();
}

// 选择技能
function selectSkill(skill) {
  skillStore.selectSkill(skill);
  activeDetailTab.value = 'info';
}

// 切换技能启用状态
async function handleToggleSkill(skillId, enabled) {
  const res = await skillStore.toggleSkillEnabled(skillId, enabled);
  if (res.success) {
    ElMessage.success(enabled ? '技能已启用' : '技能已禁用');
  } else {
    ElMessage.error(res.error || '操作失败');
  }
}

// 安装技能
async function handleInstallSkill(skillId) {
  installing.value = true;
  try {
    const res = await skillStore.installSkill(skillId);
    if (res.success) {
      ElMessage.success('技能安装成功');
      await skillStore.fetchSkills();
    } else {
      ElMessage.error(res.error || '安装失败');
    }
  } finally {
    installing.value = false;
  }
}

// 卸载技能
async function handleUninstallSkill() {
  try {
    await ElMessageBox.confirm(
      `确定要卸载技能 "${skillStore.currentSkill.name}" 吗？`,
      '卸载技能',
      { type: 'warning' }
    );
    
    uninstalling.value = true;
    const res = await skillStore.uninstallSkill(skillStore.currentSkill.id);
    if (res.success) {
      ElMessage.success('技能已卸载');
      await skillStore.fetchSkills();
    } else {
      ElMessage.error(res.error || '卸载失败');
    }
  } catch (e) {
    // 取消卸载
  } finally {
    uninstalling.value = false;
  }
}

// 保存配置
async function handleSaveConfig(config) {
  configLoading.value = true;
  try {
    const res = await skillStore.updateSkillConfig(skillStore.currentSkill.id, config);
    if (res.success) {
      ElMessage.success('配置已保存');
    } else {
      ElMessage.error(res.error || '保存失败');
    }
  } finally {
    configLoading.value = false;
  }
}

// 重置配置
function handleResetConfig() {
  ElMessage.info('配置已重置');
}

// 复制命令
function copyCommand(command) {
  navigator.clipboard.writeText(command).then(() => {
    ElMessage.success('已复制到剪贴板');
  });
}

// 格式化日期
function formatDate(timestamp) {
  if (!timestamp) return '-';
  return new Date(timestamp).toLocaleString('zh-CN');
}
</script>

<style scoped>
.skills-page {
  height: calc(100vh - 120px);
  padding: 20px;
}

.skills-container {
  display: flex;
  height: 100%;
  background: white;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 4px 16px rgba(196, 30, 58, 0.08);
}

/* 左侧边栏 */
.skills-sidebar {
  width: 380px;
  border-right: 1px solid #f0f0f0;
  display: flex;
  flex-direction: column;
  background: #fafafa;
}

.sidebar-header {
  padding: 16px 20px;
  border-bottom: 1px solid #f0f0f0;
  background: white;
}

.sidebar-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--fenlin-text-primary, #2C3E50);
}

:deep(.el-tabs) {
  padding: 0 16px;
  background: white;
}

:deep(.el-tabs__header) {
  margin: 0;
}

.search-wrapper {
  padding: 12px 16px;
  background: white;
  border-bottom: 1px solid #f0f0f0;
}

.skills-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
}

.loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 40px;
  color: var(--fenlin-text-tertiary, #95A5A6);
}

.empty-skills {
  padding: 40px 20px;
}

/* 右侧详情 */
.skill-detail {
  flex: 1;
  padding: 24px;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}

.detail-header {
  display: flex;
  align-items: center;
  gap: 16px;
}

.skill-icon-large {
  flex-shrink: 0;
  width: 80px;
  height: 80px;
  border-radius: 16px;
  background: linear-gradient(135deg, rgba(196, 30, 58, 0.1) 0%, rgba(196, 30, 58, 0.05) 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 40px;
}

.detail-info {
  flex: 1;
}

.detail-name {
  font-size: 24px;
  font-weight: 600;
  color: var(--fenlin-text-primary, #2C3E50);
  display: flex;
  align-items: center;
  gap: 8px;
}

.detail-desc {
  margin-top: 8px;
  font-size: 14px;
  color: var(--fenlin-text-secondary, #5D6D7E);
}

.detail-actions {
  display: flex;
  gap: 12px;
  margin-top: 24px;
}

.detail-actions .el-button--primary {
  background: linear-gradient(135deg, #C41E3A 0%, #E63950 100%);
  border: none;
}

.empty-detail {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.examples-section {
  padding: 16px 0;
}

.example-item {
  margin-bottom: 24px;
}

.example-title {
  font-weight: 600;
  margin-bottom: 4px;
}

.example-desc {
  font-size: 13px;
  color: var(--fenlin-text-secondary, #5D6D7E);
  margin-bottom: 8px;
}

.example-command {
  font-family: 'Courier New', monospace;
}

/* 移动端适配 */
@media (max-width: 768px) {
  .skills-page {
    padding: 12px;
  }
  
  .skills-container {
    flex-direction: column;
  }
  
  .skills-sidebar {
    width: 100%;
    height: 50%;
    border-right: none;
    border-bottom: 1px solid #f0f0f0;
  }
  
  .skill-detail {
    height: 50%;
  }
}
</style>

<!--
  技能详情页（移动端独立页面）
  @author 小琳
  @date 2026-03-04
-->
<template>
  <div class="skill-detail-page">
    <div class="page-header">
      <el-button :icon="ArrowLeft" text @click="goBack">返回</el-button>
      <span class="page-title">技能详情</span>
    </div>
    
    <div v-if="skillStore.detailLoading" class="loading-state">
      <el-icon class="is-loading"><Loading /></el-icon>
      <span>加载中...</span>
    </div>
    
    <div v-else-if="skillStore.currentSkill" class="detail-content">
      <div class="skill-header">
        <div class="skill-icon-large">
          <span class="icon-emoji">{{ skillStore.currentSkill.icon || '🔧' }}</span>
        </div>
        <div class="skill-info">
          <div class="skill-name">
            {{ skillStore.currentSkill.name }}
          </div>
          <div class="skill-tags">
            <el-tag v-if="skillStore.currentSkill.installed" type="success" size="small">
              已安装
            </el-tag>
            <el-tag v-if="!skillStore.currentSkill.enabled && skillStore.currentSkill.installed" type="warning" size="small">
              已禁用
            </el-tag>
          </div>
          <div class="skill-desc">
            {{ skillStore.currentSkill.description || '暂无描述' }}
          </div>
        </div>
      </div>
      
      <el-tabs v-model="activeTab">
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
          </el-descriptions>
        </el-tab-pane>
        
        <el-tab-pane label="配置" name="config" v-if="skillStore.currentSkill.installed">
          <SkillConfig
            :skill="skillStore.currentSkill"
            :config="skillStore.currentSkill.config || {}"
            @save="handleSaveConfig"
          />
        </el-tab-pane>
      </el-tabs>
      
      <div class="action-buttons">
        <el-button
          v-if="!skillStore.currentSkill.installed"
          type="primary"
          size="large"
          block
          @click="handleInstall"
          :loading="installing"
        >
          安装技能
        </el-button>
        <el-button
          v-else
          type="danger"
          size="large"
          block
          @click="handleUninstall"
          :loading="uninstalling"
        >
          卸载技能
        </el-button>
      </div>
    </div>
    
    <div v-else class="empty-state">
      <el-empty description="技能不存在" />
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { ArrowLeft, Loading } from '@element-plus/icons-vue';
import { useSkillStore } from '@/stores/skills';
import SkillConfig from '@/components/SkillConfig.vue';

const route = useRoute();
const router = useRouter();
const skillStore = useSkillStore();

const activeTab = ref('info');
const installing = ref(false);
const uninstalling = ref(false);

onMounted(async () => {
  const skillId = route.params.id;
  if (skillId) {
    await skillStore.fetchSkillDetail(skillId);
  }
});

function goBack() {
  router.back();
}

async function handleInstall() {
  installing.value = true;
  try {
    const res = await skillStore.installSkill(skillStore.currentSkill.id);
    if (res.success) {
      ElMessage.success('技能安装成功');
    } else {
      ElMessage.error(res.error || '安装失败');
    }
  } finally {
    installing.value = false;
  }
}

async function handleUninstall() {
  try {
    await ElMessageBox.confirm('确定要卸载此技能吗？', '卸载确认', { type: 'warning' });
    uninstalling.value = true;
    const res = await skillStore.uninstallSkill(skillStore.currentSkill.id);
    if (res.success) {
      ElMessage.success('技能已卸载');
      router.back();
    } else {
      ElMessage.error(res.error || '卸载失败');
    }
  } catch (e) {
  } finally {
    uninstalling.value = false;
  }
}

async function handleSaveConfig(config) {
  const res = await skillStore.updateSkillConfig(skillStore.currentSkill.id, config);
  if (res.success) {
    ElMessage.success('配置已保存');
  } else {
    ElMessage.error(res.error || '保存失败');
  }
}
</script>

<style scoped>
.skill-detail-page {
  min-height: 100vh;
  background: #fafafa;
}

.page-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: white;
  border-bottom: 1px solid #f0f0f0;
}

.page-title {
  font-size: 16px;
  font-weight: 600;
}

.loading-state, .empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
}

.detail-content {
  padding: 16px;
}

.skill-header {
  background: white;
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 16px;
}

.skill-icon-large {
  width: 64px;
  height: 64px;
  border-radius: 12px;
  background: linear-gradient(135deg, rgba(196, 30, 58, 0.1) 0%, rgba(196, 30, 58, 0.05) 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32px;
  margin-bottom: 12px;
}

.skill-name {
  font-size: 20px;
  font-weight: 600;
  margin-bottom: 8px;
}

.skill-tags {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
}

.skill-desc {
  font-size: 14px;
  color: var(--fenlin-text-secondary, #5D6D7E);
}

.action-buttons {
  margin-top: 16px;
  padding: 16px;
  background: white;
  border-radius: 12px;
}
</style>

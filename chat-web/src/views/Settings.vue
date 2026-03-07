<!--
  设置页面 - 主入口
  @author 小琳
  @date 2026-03-04
-->
<template>
  <div class="settings-page">
    <el-row :gutter="24">
      <el-col :xs="24" :sm="24" :md="24">
        <el-card class="settings-card">
          <template #header>
            <div class="card-header">
              <span class="title">
                <el-icon><Setting /></el-icon>
                系统设置
              </span>
            </div>
          </template>

          <el-tabs v-model="activeTab" class="settings-tabs">
            <!-- 主题设置 -->
            <el-tab-pane label="主题" name="theme">
              <ThemeSettings />
            </el-tab-pane>

            <!-- 快捷键设置 - 仅PC端显示 -->
            <el-tab-pane v-if="!isMobile" label="快捷键" name="shortcut">
              <ShortcutSettings />
            </el-tab-pane>

            <!-- 通知设置 -->
            <el-tab-pane label="通知" name="notification">
              <NotificationSettings />
            </el-tab-pane>
          </el-tabs>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { Setting } from '@element-plus/icons-vue';
import ThemeSettings from './ThemeSettings.vue';
import ShortcutSettings from './ShortcutSettings.vue';
import NotificationSettings from './NotificationSettings.vue';

const activeTab = ref('theme');
const windowWidth = ref(window.innerWidth);

const isMobile = computed(() => windowWidth.value < 768);

const handleResize = () => {
  windowWidth.value = window.innerWidth;
  // 如果切换到移动端且当前在快捷键tab，自动切换到主题
  if (windowWidth.value < 768 && activeTab.value === 'shortcut') {
    activeTab.value = 'theme';
  }
};

onMounted(() => {
  window.addEventListener('resize', handleResize);
});

onUnmounted(() => {
  window.removeEventListener('resize', handleResize);
});
</script>

<style scoped>
.settings-page {
  max-width: 900px;
  margin: 0 auto;
  padding: 16px;
}

.settings-card {
  border-radius: var(--fenlin-radius-lg, 16px);
  box-shadow: var(--fenlin-shadow-sm, 0 2px 8px rgba(196, 30, 58, 0.08));
  border: 1px solid rgba(196, 30, 58, 0.1);
}

.settings-card :deep(.el-card__header) {
  background: linear-gradient(135deg, rgba(196, 30, 58, 0.05) 0%, rgba(212, 160, 23, 0.05) 100%);
  border-bottom: 2px solid rgba(196, 30, 58, 0.1);
  padding: 16px 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-header .title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  color: var(--fenlin-text-primary, #2C3E50);
  font-size: 16px;
}

.card-header .title .el-icon {
  color: var(--fenlin-primary, #C41E3A);
}

.settings-tabs :deep(.el-tabs__header) {
  margin-bottom: 24px;
}

.settings-tabs :deep(.el-tabs__nav-wrap::after) {
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(196, 30, 58, 0.2), transparent);
}

.settings-tabs :deep(.el-tabs__item) {
  font-size: 15px;
  padding: 0 24px;
  height: 44px;
  line-height: 44px;
  color: var(--fenlin-text-secondary, #5A6C7D);
  transition: var(--fenlin-transition, all 0.3s cubic-bezier(0.4, 0, 0.2, 1));
}

.settings-tabs :deep(.el-tabs__item:hover) {
  color: var(--fenlin-primary, #C41E3A);
}

.settings-tabs :deep(.el-tabs__item.is-active) {
  color: var(--fenlin-primary, #C41E3A);
  font-weight: 600;
}

.settings-tabs :deep(.el-tabs__active-bar) {
  background: var(--fenlin-gradient-primary, linear-gradient(135deg, #C41E3A 0%, #E63950 100%));
  height: 3px;
  border-radius: 2px;
}

.settings-tabs :deep(.el-tabs__content) {
  padding: 0 8px;
}

/* 移动端适配 */
@media (max-width: 768px) {
  .settings-page {
    padding: 12px;
  }

  .settings-card :deep(.el-card__header) {
    padding: 12px 16px;
  }

  .card-header .title {
    font-size: 15px;
  }

  .settings-tabs :deep(.el-tabs__item) {
    font-size: 14px;
    padding: 0 16px;
  }

  .settings-tabs :deep(.el-tabs__content) {
    padding: 0;
  }
}
</style>

<!--
  根组件
  @author 小琳
  @date 2026-02-06
-->
<template>
  <router-view />
</template>

<script setup>
import { onMounted } from 'vue';
import { useUserStore } from '@/stores/user';
import { useSettingsStore } from '@/stores/settings';

const userStore = useUserStore();
const settingsStore = useSettingsStore();

// 加载主题设置（强调色）
function loadThemeSettings() {
  try {
    const saved = localStorage.getItem('fenlin_themeSettings');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.accentColor) {
        // 应用强调色到 CSS 变量
        const accentColorMap = {
          maple: { primary: '#C41E3A', light: '#E63950' },
          ocean: { primary: '#1E88E5', light: '#42A5F5' },
          forest: { primary: '#43A047', light: '#66BB6A' },
          sunset: { primary: '#F57C00', light: '#FFB74D' },
          lavender: { primary: '#7B1FA2', light: '#AB47BC' },
          rose: { primary: '#C2185B', light: '#F06292' }
        };
        
        const colors = accentColorMap[parsed.accentColor] || accentColorMap.maple;
        document.documentElement.setAttribute('data-accent', parsed.accentColor);
        document.documentElement.style.setProperty('--fenlin-primary', colors.primary);
        document.documentElement.style.setProperty('--fenlin-primary-light', colors.light);
        document.documentElement.style.setProperty('--fenlin-gradient-primary', `linear-gradient(135deg, ${colors.primary} 0%, ${colors.light} 100%)`);
      }
    }
  } catch (e) {
    console.error('加载主题设置失败:', e);
  }
}

onMounted(async () => {
  // 初始化设置（主题、字体等）
  settingsStore.init();
  
  // 加载主题设置（强调色）
  loadThemeSettings();
  
  // 如果有 token，获取用户信息
  if (userStore.accessToken) {
    await userStore.fetchUser();
  }
});
</script>

<style>
/* 全局样式在 styles/global.css */
</style>
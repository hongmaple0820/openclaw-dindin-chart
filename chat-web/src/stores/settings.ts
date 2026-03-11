/**
 * 设置状态管理
 * @author 小琳
 * @date 2026-03-05
 */
import { defineStore } from 'pinia';
import { ref, watch } from 'vue';

// 主题类型
export const THEME_LIGHT = 'light';
export const THEME_DARK = 'dark';
export const THEME_SYSTEM = 'system';

// 可用字体
export const AVAILABLE_FONTS = [
  { value: 'system', label: '系统默认', family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif' },
  { value: 'noto-sans', label: '思源黑体', family: '"Noto Sans SC", "Microsoft YaHei", sans-serif' },
  { value: 'noto-serif', label: '思源宋体', family: '"Noto Serif SC", "SimSun", serif' },
  { value: 'lxgw-wenkai', label: '霞鹜文楷', family: '"LXGW WenKai", "Microsoft YaHei", sans-serif' },
  { value: 'zcool-kuaile', label: '站酷快乐体', family: '"ZCOOL KuaiLe", "Microsoft YaHei", sans-serif' },
  { value: 'ma-shan-zheng', label: '马善政毛笔楷', family: '"Ma Shan Zheng", cursive' }
];

// 字体大小选项
export const FONT_SIZES = [
  { value: 'small', label: '小', size: '14px' },
  { value: 'medium', label: '中', size: '16px' },
  { value: 'large', label: '大', size: '18px' },
  { value: 'xlarge', label: '特大', size: '20px' }
];

export const useSettingsStore = defineStore('settings', () => {
  // 从本地存储加载设置
  const loadSetting = (key, defaultValue) => {
    const stored = localStorage.getItem(`fenlin_${key}`);
    return stored !== null ? stored : defaultValue;
  };

  // 主题设置
  const theme = ref(loadSetting('theme', THEME_SYSTEM));
  
  // 字体设置
  const fontFamily = ref(loadSetting('fontFamily', 'system'));
  const fontSize = ref(loadSetting('fontSize', 'medium'));
  
  // 侧边栏折叠状态
  const sidebarCollapsed = ref(loadSetting('sidebarCollapsed', 'false') === 'true');
  
  // 聊天框是否显示
  const chatBoxVisible = ref(true);

  // 获取实际主题（处理 system 主题）
  const getActualTheme = () => {
    if (theme.value === THEME_SYSTEM) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? THEME_DARK : THEME_LIGHT;
    }
    return theme.value;
  };

  // 应用主题
  const applyTheme = () => {
    const actualTheme = getActualTheme();
    document.documentElement.setAttribute('data-theme', actualTheme);
    
    // 更新 Element Plus 主题
    if (actualTheme === THEME_DARK) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  // 应用字体
  const applyFont = () => {
    const fontConfig = AVAILABLE_FONTS.find(f => f.value === fontFamily.value);
    const sizeConfig = FONT_SIZES.find(s => s.value === fontSize.value);
    
    if (fontConfig) {
      document.documentElement.style.setProperty('--fenlin-font-family', fontConfig.family);
    }
    if (sizeConfig) {
      document.documentElement.style.setProperty('--fenlin-font-size', sizeConfig.size);
    }
  };

  // 设置主题
  const setTheme = (newTheme) => {
    theme.value = newTheme;
    localStorage.setItem('fenlin_theme', newTheme);
    applyTheme();
  };

  // 设置字体
  const setFontFamily = (newFont) => {
    fontFamily.value = newFont;
    localStorage.setItem('fenlin_fontFamily', newFont);
    applyFont();
  };

  // 设置字体大小
  const setFontSize = (newSize) => {
    fontSize.value = newSize;
    localStorage.setItem('fenlin_fontSize', newSize);
    applyFont();
  };

  // 切换侧边栏
  const toggleSidebar = () => {
    sidebarCollapsed.value = !sidebarCollapsed.value;
    localStorage.setItem('fenlin_sidebarCollapsed', sidebarCollapsed.value.toString());
  };

  // 切换聊天框
  const toggleChatBox = () => {
    chatBoxVisible.value = !chatBoxVisible.value;
  };

  // 初始化
  const init = () => {
    applyTheme();
    applyFont();
    
    // 监听系统主题变化
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (theme.value === THEME_SYSTEM) {
        applyTheme();
      }
    });
  };

  // 监听设置变化
  watch(theme, applyTheme);
  watch(fontFamily, applyFont);
  watch(fontSize, applyFont);

  return {
    // 状态
    theme,
    fontFamily,
    fontSize,
    sidebarCollapsed,
    chatBoxVisible,
    
    // 方法
    setTheme,
    setFontFamily,
    setFontSize,
    toggleSidebar,
    toggleChatBox,
    getActualTheme,
    init
  };
});
<!--
  主题设置组件
  @author 小琳
  @date 2026-03-04
-->
<template>
  <div class="theme-settings">
    <!-- 主题模式 -->
    <div class="setting-section">
      <h3 class="section-title">主题模式</h3>
      <div class="theme-modes">
        <div
          v-for="mode in themeModes"
          :key="mode.value"
          class="theme-mode-card"
          :class="{ active: settings.themeMode === mode.value }"
          @click="setThemeMode(mode.value)"
        >
          <div class="mode-preview" :class="mode.value">
            <div class="preview-header"></div>
            <div class="preview-content">
              <div class="preview-line"></div>
              <div class="preview-line short"></div>
            </div>
          </div>
          <div class="mode-info">
            <span class="mode-icon">{{ mode.icon }}</span>
            <span class="mode-name">{{ mode.label }}</span>
          </div>
          <el-icon v-if="settings.themeMode === mode.value" class="check-icon"><Check /></el-icon>
        </div>
      </div>
    </div>

    <!-- 字体大小 -->
    <div class="setting-section">
      <h3 class="section-title">字体大小</h3>
      <div class="font-size-setting">
        <span class="size-label small">小</span>
        <el-slider
          v-model="settings.fontSize"
          :min="12"
          :max="20"
          :step="1"
          :marks="fontSizeMarks"
          @change="handleFontSizeChange"
        />
        <span class="size-label large">大</span>
      </div>
      <div class="preview-text" :style="{ fontSize: settings.fontSize + 'px' }">
        预览文字效果：枫琳 - 让智能自然融入生活
      </div>
    </div>

    <!-- 强调色 -->
    <div class="setting-section">
      <h3 class="section-title">强调色</h3>
      <div class="accent-colors">
        <div
          v-for="color in accentColors"
          :key="color.value"
          class="color-option"
          :class="{ active: settings.accentColor === color.value }"
          @click="setAccentColor(color.value)"
        >
          <div class="color-preview" :style="{ background: color.gradient }"></div>
          <span class="color-name">{{ color.label }}</span>
          <el-icon v-if="settings.accentColor === color.value" class="check-icon"><Check /></el-icon>
        </div>
      </div>
    </div>

    <!-- 实时预览 -->
    <div class="setting-section preview-section">
      <h3 class="section-title">实时预览</h3>
      <div class="preview-container" :class="[actualTheme, 'accent-' + settings.accentColor]">
        <div class="preview-header">
          <div class="preview-avatar"></div>
          <div class="preview-info">
            <div class="preview-name">枫琳</div>
            <div class="preview-status">在线</div>
          </div>
        </div>
        <div class="preview-messages">
          <div class="preview-message received">
            <div class="message-bubble">你好！这是主题预览效果～</div>
          </div>
          <div class="preview-message sent">
            <div class="message-bubble">看起来很棒！✨</div>
          </div>
        </div>
        <div class="preview-input">
          <div class="input-placeholder">输入消息...</div>
          <div class="send-button">发送</div>
        </div>
      </div>
    </div>

    <!-- 保存按钮 -->
    <div class="setting-actions">
      <el-button @click="resetSettings">恢复默认</el-button>
      <el-button type="primary" :loading="saving" @click="saveSettings">保存设置</el-button>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, watch, computed } from 'vue';
import { ElMessage } from 'element-plus';
import { Check } from '@element-plus/icons-vue';
import { useSettingsStore, THEME_LIGHT, THEME_DARK, THEME_SYSTEM, AVAILABLE_FONTS, FONT_SIZES } from '@/stores/settings';

const settingsStore = useSettingsStore();

// 主题模式选项
const themeModes = [
  { value: THEME_LIGHT, label: '明亮', icon: '☀️' },
  { value: THEME_DARK, label: '暗黑', icon: '🌙' },
  { value: THEME_SYSTEM, label: '跟随系统', icon: '🖥️' }
];

// 字体大小标记 - 从 FONT_SIZES 生成
const fontSizeMarks = computed(() => {
  const marks = {};
  FONT_SIZES.forEach(s => {
    marks[parseInt(s.size)] = s.label;
  });
  return marks;
});

// 强调色选项
const accentColors = [
  { value: 'maple', label: '枫叶红', gradient: 'linear-gradient(135deg, #C41E3A 0%, #E63950 100%)' },
  { value: 'ocean', label: '海洋蓝', gradient: 'linear-gradient(135deg, #1E88E5 0%, #42A5F5 100%)' },
  { value: 'forest', label: '森林绿', gradient: 'linear-gradient(135deg, #43A047 0%, #66BB6A 100%)' },
  { value: 'sunset', label: '落日橙', gradient: 'linear-gradient(135deg, #F57C00 0%, #FFB74D 100%)' },
  { value: 'lavender', label: '薰衣草', gradient: 'linear-gradient(135deg, #7B1FA2 0%, #AB47BC 100%)' },
  { value: 'rose', label: '玫瑰粉', gradient: 'linear-gradient(135deg, #C2185B 0%, #F06292 100%)' }
];

// 设置状态 - 使用 settingsStore
const saving = ref(false);
const settings = reactive({
  themeMode: settingsStore.theme,
  fontSize: parseInt(FONT_SIZES.find(s => s.value === settingsStore.fontSize)?.size || '16'),
  accentColor: 'maple'
});

// 监听 settingsStore 变化，同步到本地 settings
watch(() => settingsStore.theme, (newTheme) => {
  settings.themeMode = newTheme;
});

watch(() => settingsStore.fontSize, (newSize) => {
  const sizeConfig = FONT_SIZES.find(s => s.value === newSize);
  if (sizeConfig) {
    settings.fontSize = parseInt(sizeConfig.size);
  }
});

// 计算实际应用的主题
const actualTheme = computed(() => {
  if (settings.themeMode === THEME_SYSTEM) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? THEME_DARK : THEME_LIGHT;
  }
  return settings.themeMode;
});

// 默认设置
const defaultSettings = {
  themeMode: THEME_SYSTEM,
  fontSize: 16,
  accentColor: 'maple'
};

// 加载设置
const loadSettings = () => {
  // 主题和字体从 settingsStore 加载
  settings.themeMode = settingsStore.theme;
  const sizeConfig = FONT_SIZES.find(s => s.value === settingsStore.fontSize);
  if (sizeConfig) {
    settings.fontSize = parseInt(sizeConfig.size);
  }
  
  // 强调色从本地存储加载
  try {
    const saved = localStorage.getItem('fenlin_themeSettings');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.accentColor) {
        settings.accentColor = parsed.accentColor;
      }
    }
  } catch (error) {
    console.error('加载设置失败:', error);
  }
  
  // 立即应用设置
  applySettings();
};

// 应用设置
const applySettings = () => {
  // 使用 settingsStore 的方法应用主题
  settingsStore.setTheme(settings.themeMode);
  
  // 应用字体大小 - 转换像素值到枚举值
  const sizeConfig = FONT_SIZES.find(s => parseInt(s.size) === settings.fontSize);
  if (sizeConfig) {
    settingsStore.setFontSize(sizeConfig.value);
  }

  // 应用强调色到 CSS 变量
  document.documentElement.setAttribute('data-accent', settings.accentColor);
  
  // 根据强调色设置 CSS 变量
  const accentColorMap = {
    maple: { primary: '#C41E3A', light: '#E63950' },
    ocean: { primary: '#1E88E5', light: '#42A5F5' },
    forest: { primary: '#43A047', light: '#66BB6A' },
    sunset: { primary: '#F57C00', light: '#FFB74D' },
    lavender: { primary: '#7B1FA2', light: '#AB47BC' },
    rose: { primary: '#C2185B', light: '#F06292' }
  };
  
  const colors = accentColorMap[settings.accentColor] || accentColorMap.maple;
  document.documentElement.style.setProperty('--fenlin-primary', colors.primary);
  document.documentElement.style.setProperty('--fenlin-primary-light', colors.light);
  document.documentElement.style.setProperty('--fenlin-gradient-primary', `linear-gradient(135deg, ${colors.primary} 0%, ${colors.light} 100%)`);
  
  // 保存强调色到 localStorage
  localStorage.setItem('fenlin_themeSettings', JSON.stringify({
    accentColor: settings.accentColor
  }));
};

// 设置主题模式
const setThemeMode = (mode) => {
  settings.themeMode = mode;
  settingsStore.setTheme(mode);
  // 立即显示成功提示
  ElMessage.success(`已切换到${themeModes.find(m => m.value === mode)?.label}模式`);
};

// 设置强调色
const setAccentColor = (color) => {
  settings.accentColor = color;
  // 立即应用并保存
  applySettings();
};

// 字体大小变化
const handleFontSizeChange = (value) => {
  const sizeConfig = FONT_SIZES.find(s => parseInt(s.size) === value);
  if (sizeConfig) {
    settingsStore.setFontSize(sizeConfig.value);
  }
};

// 保存设置
const saveSettings = async () => {
  saving.value = true;
  try {
    // 主题和字体已通过 settingsStore 自动保存
    // 只需保存强调色
    localStorage.setItem('themeSettings', JSON.stringify({
      accentColor: settings.accentColor
    }));
    applySettings();
    ElMessage.success('设置已保存');
  } catch (error) {
    ElMessage.error('保存设置失败');
  } finally {
    saving.value = false;
  }
};

// 恢复默认设置
const resetSettings = () => {
  Object.assign(settings, defaultSettings);
  settingsStore.setTheme(defaultSettings.themeMode);
  const sizeConfig = FONT_SIZES.find(s => parseInt(s.size) === defaultSettings.fontSize);
  if (sizeConfig) {
    settingsStore.setFontSize(sizeConfig.value);
  }
  // 立即应用默认设置
  applySettings();
  ElMessage.info('已恢复默认设置');
};

// 监听系统主题变化
const handleSystemThemeChange = (e) => {
  if (settings.themeMode === THEME_SYSTEM) {
    settingsStore.applyTheme();
  }
};

onMounted(() => {
  loadSettings();
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', handleSystemThemeChange);
});
</script>

<style scoped>
.theme-settings {
  padding: 8px 0;
}

.setting-section {
  margin-bottom: 32px;
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--fenlin-text-primary, #2C3E50);
  margin-bottom: 16px;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(196, 30, 58, 0.1);
}

/* 主题模式选择 */
.theme-modes {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

.theme-mode-card {
  position: relative;
  padding: 16px;
  border: 2px solid transparent;
  border-radius: var(--fenlin-radius-md, 12px);
  background: var(--fenlin-surface, #FFFFFF);
  cursor: pointer;
  transition: var(--fenlin-transition, all 0.3s cubic-bezier(0.4, 0, 0.2, 1));
  box-shadow: var(--fenlin-shadow-sm, 0 2px 8px rgba(196, 30, 58, 0.08));
}

.theme-mode-card:hover {
  border-color: rgba(196, 30, 58, 0.3);
  transform: translateY(-2px);
  box-shadow: var(--fenlin-shadow-md, 0 4px 16px rgba(196, 30, 58, 0.12));
}

.theme-mode-card.active {
  border-color: var(--fenlin-primary, #C41E3A);
  background: linear-gradient(135deg, rgba(196, 30, 58, 0.05) 0%, rgba(212, 160, 23, 0.05) 100%);
}

.mode-preview {
  height: 80px;
  border-radius: 8px;
  margin-bottom: 12px;
  overflow: hidden;
  border: 1px solid var(--fenlin-border, #E0E0E0);
}

.mode-preview.light {
  background: #FAFAFA;
}

.mode-preview.dark {
  background: #1a1a2e;
}

.mode-preview.system {
  background: linear-gradient(135deg, #FAFAFA 50%, #1a1a2e 50%);
}

.preview-header {
  height: 24px;
  background: linear-gradient(135deg, #C41E3A 0%, #E63950 100%);
}

.preview-content {
  padding: 12px;
}

.preview-line {
  height: 8px;
  background: var(--fenlin-border, #E0E0E0);
  border-radius: 4px;
  margin-bottom: 8px;
}

.mode-preview.dark .preview-line {
  background: #333;
}

.preview-line.short {
  width: 60%;
}

.mode-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.mode-icon {
  font-size: 18px;
}

.mode-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--fenlin-text-primary, #2C3E50);
}

.check-icon {
  position: absolute;
  top: 12px;
  right: 12px;
  color: var(--fenlin-primary, #C41E3A);
  font-size: 20px;
}

/* 字体大小设置 */
.font-size-setting {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px 0;
}

.size-label {
  font-size: 14px;
  color: var(--fenlin-text-tertiary, #95A5A6);
  min-width: 24px;
}

.size-label.small {
  text-align: right;
}

.font-size-setting :deep(.el-slider) {
  flex: 1;
}

.font-size-setting :deep(.el-slider__runway) {
  height: 8px;
  border-radius: 4px;
}

.font-size-setting :deep(.el-slider__bar) {
  background: var(--fenlin-gradient-primary, linear-gradient(135deg, #C41E3A 0%, #E63950 100%));
}

.font-size-setting :deep(.el-slider__button) {
  width: 20px;
  height: 20px;
  border: 3px solid var(--fenlin-primary, #C41E3A);
}

.preview-text {
  margin-top: 16px;
  padding: 16px;
  background: var(--fenlin-bg-secondary, #F5F5F5);
  border-radius: var(--fenlin-radius-sm, 8px);
  text-align: center;
  color: var(--fenlin-text-primary, #2C3E50);
}

/* 强调色选择 */
.accent-colors {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 12px;
}

.color-option {
  position: relative;
  padding: 12px;
  border: 2px solid transparent;
  border-radius: var(--fenlin-radius-sm, 8px);
  cursor: pointer;
  transition: var(--fenlin-transition, all 0.3s cubic-bezier(0.4, 0, 0.2, 1));
  text-align: center;
}

.color-option:hover {
  border-color: rgba(196, 30, 58, 0.3);
  background: rgba(196, 30, 58, 0.02);
}

.color-option.active {
  border-color: var(--fenlin-primary, #C41E3A);
  background: linear-gradient(135deg, rgba(196, 30, 58, 0.05) 0%, rgba(212, 160, 23, 0.05) 100%);
}

.color-preview {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  margin: 0 auto 8px;
  box-shadow: var(--fenlin-shadow-sm, 0 2px 8px rgba(196, 30, 58, 0.2));
}

.color-name {
  font-size: 13px;
  color: var(--fenlin-text-secondary, #5A6C7D);
}

.color-option .check-icon {
  position: absolute;
  top: 8px;
  right: 8px;
  font-size: 16px;
  color: var(--fenlin-primary, #C41E3A);
}

/* 实时预览 */
.preview-section {
  margin-top: 40px;
}

.preview-container {
  border: 1px solid var(--fenlin-border, #E0E0E0);
  border-radius: var(--fenlin-radius-md, 12px);
  overflow: hidden;
  background: var(--fenlin-surface, #FFFFFF);
}

.preview-container.dark {
  background: #1a1a2e;
  border-color: #333;
}

.preview-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: linear-gradient(135deg, rgba(196, 30, 58, 0.05) 0%, rgba(212, 160, 23, 0.05) 100%);
  border-bottom: 1px solid var(--fenlin-border, #E0E0E0);
}

.preview-container.dark .preview-header {
  background: rgba(255, 255, 255, 0.05);
  border-bottom-color: #333;
}

.preview-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--fenlin-gradient-primary, linear-gradient(135deg, #C41E3A 0%, #E63950 100%));
}

.preview-info {
  flex: 1;
}

.preview-name {
  font-weight: 600;
  font-size: 15px;
  color: var(--fenlin-text-primary, #2C3E50);
}

.preview-container.dark .preview-name {
  color: #fff;
}

.preview-status {
  font-size: 12px;
  color: var(--fenlin-accent, #228B22);
}

.preview-messages {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 120px;
}

.preview-message {
  display: flex;
}

.preview-message.received {
  justify-content: flex-start;
}

.preview-message.sent {
  justify-content: flex-end;
}

.message-bubble {
  padding: 10px 16px;
  border-radius: 16px;
  max-width: 70%;
  font-size: 14px;
}

.preview-message.received .message-bubble {
  background: var(--fenlin-bg-secondary, #F5F5F5);
  color: var(--fenlin-text-primary, #2C3E50);
  border-bottom-left-radius: 4px;
}

.preview-container.dark .preview-message.received .message-bubble {
  background: #333;
  color: #fff;
}

.preview-message.sent .message-bubble {
  background: var(--fenlin-gradient-primary, linear-gradient(135deg, #C41E3A 0%, #E63950 100%));
  color: white;
  border-bottom-right-radius: 4px;
}

.preview-input {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-top: 1px solid var(--fenlin-border, #E0E0E0);
}

.preview-container.dark .preview-input {
  border-top-color: #333;
}

.input-placeholder {
  flex: 1;
  padding: 10px 16px;
  background: var(--fenlin-bg-secondary, #F5F5F5);
  border-radius: 20px;
  font-size: 14px;
  color: var(--fenlin-text-tertiary, #95A5A6);
}

.preview-container.dark .input-placeholder {
  background: #333;
  color: #666;
}

.send-button {
  padding: 8px 20px;
  background: var(--fenlin-gradient-primary, linear-gradient(135deg, #C41E3A 0%, #E63950 100%));
  color: white;
  border-radius: 20px;
  font-size: 14px;
  font-weight: 500;
}

/* 保存按钮 */
.setting-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding-top: 24px;
  border-top: 1px solid rgba(196, 30, 58, 0.1);
}

.setting-actions :deep(.el-button) {
  border-radius: var(--fenlin-radius-sm, 8px);
}

.setting-actions :deep(.el-button--primary) {
  background: var(--fenlin-gradient-primary, linear-gradient(135deg, #C41E3A 0%, #E63950 100%));
  border: none;
  box-shadow: var(--fenlin-shadow-sm, 0 2px 8px rgba(196, 30, 58, 0.3));
}

.setting-actions :deep(.el-button--primary:hover) {
  transform: translateY(-2px);
  box-shadow: var(--fenlin-shadow-md, 0 4px 12px rgba(196, 30, 58, 0.4));
}

/* 移动端适配 */
@media (max-width: 768px) {
  .theme-modes {
    grid-template-columns: 1fr;
  }

  .accent-colors {
    grid-template-columns: repeat(2, 1fr);
  }

  .font-size-setting {
    flex-wrap: wrap;
  }

  .setting-actions {
    flex-direction: column;
  }

  .setting-actions :deep(.el-button) {
    width: 100%;
  }
}
</style>

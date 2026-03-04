<!--
  快捷键设置组件（仅PC端）
  @author 小琳
  @date 2026-03-04
-->
<template>
  <div class="shortcut-settings">
    <!-- 快捷键列表 -->
    <div class="setting-section">
      <h3 class="section-title">快捷键列表</h3>
      <p class="section-desc">点击快捷键项可以重新录制，按 Esc 取消</p>
      
      <div class="shortcut-list">
        <div
          v-for="shortcut in shortcuts"
          :key="shortcut.id"
          class="shortcut-item"
          :class="{ recording: recordingId === shortcut.id }"
        >
          <div class="shortcut-info">
            <span class="shortcut-name">{{ shortcut.name }}</span>
            <span class="shortcut-desc">{{ shortcut.description }}</span>
          </div>
          <div class="shortcut-keys">
            <template v-if="recordingId === shortcut.id">
              <div class="recording-hint">
                <span class="recording-dot"></span>
                按下快捷键...
              </div>
            </template>
            <template v-else>
              <div class="key-badge" v-for="key in formatKeys(shortcut.keys)" :key="key">
                {{ key }}
              </div>
            </template>
            <div class="shortcut-actions">
              <el-button
                v-if="recordingId !== shortcut.id"
                size="small"
                text
                @click="startRecording(shortcut)"
              >
                修改
              </el-button>
              <el-button
                v-else
                size="small"
                text
                type="primary"
                @click="cancelRecording"
              >
                取消
              </el-button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 全局快捷键开关 -->
    <div class="setting-section">
      <h3 class="section-title">全局设置</h3>
      <div class="global-setting">
        <div class="setting-info">
          <span class="setting-name">启用全局快捷键</span>
          <span class="setting-desc">允许在应用外使用快捷键（需要系统权限）</span>
        </div>
        <el-switch v-model="globalEnabled" @change="handleGlobalChange" />
      </div>
      <div class="global-setting">
        <div class="setting-info">
          <span class="setting-name">显示快捷键提示</span>
          <span class="setting-desc">在按钮旁显示对应的快捷键</span>
        </div>
        <el-switch v-model="showHints" @change="handleShowHintsChange" />
      </div>
    </div>

    <!-- 冲突检测 -->
    <div v-if="conflicts.length > 0" class="setting-section conflict-section">
      <h3 class="section-title conflict-title">
        <el-icon><Warning /></el-icon>
        快捷键冲突
      </h3>
      <div class="conflict-list">
        <div v-for="conflict in conflicts" :key="conflict.keys" class="conflict-item">
          <span class="conflict-keys">{{ conflict.keys }}</span>
          <span class="conflict-items">
            被 <strong>{{ conflict.items.join('、') }}</strong> 同时使用
          </span>
        </div>
      </div>
      <el-button type="warning" size="small" @click="resolveConflicts">
        自动解决冲突
      </el-button>
    </div>

    <!-- 操作按钮 -->
    <div class="setting-actions">
      <el-button @click="resetShortcuts">恢复默认</el-button>
      <el-button type="primary" :loading="saving" @click="saveShortcuts">保存设置</el-button>
    </div>

    <!-- 快捷键录制对话框 -->
    <el-dialog
      v-model="showRecordDialog"
      title="录制快捷键"
      width="400px"
      :close-on-click-modal="false"
      @close="cancelRecording"
    >
      <div class="record-dialog-content">
        <div class="record-target">
          为 <strong>{{ currentShortcut?.name }}</strong> 设置快捷键
        </div>
        <div class="record-area" :class="{ active: isRecording }">
          <div class="record-icon">⌨️</div>
          <div class="record-text">
            <template v-if="recordedKeys.length === 0">
              点击此区域并按下快捷键组合
            </template>
            <template v-else>
              <span class="recorded-keys">
                <span v-for="key in recordedKeys" :key="key" class="key-badge">{{ key }}</span>
              </span>
            </template>
          </div>
        </div>
        <p class="record-tip">
          支持的组合键：Ctrl、Alt、Shift + 其他按键<br>
          按 Esc 取消，按 Enter 确认
        </p>
      </div>
      <template #footer>
        <el-button @click="cancelRecording">取消</el-button>
        <el-button
          type="primary"
          :disabled="recordedKeys.length < 2"
          @click="confirmRecording"
        >
          确认
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Warning } from '@element-plus/icons-vue';

// 默认快捷键配置
const defaultShortcuts = [
  { id: 'newChat', name: '新建对话', description: '创建一个新的对话窗口', keys: ['Ctrl', 'N'] },
  { id: 'search', name: '搜索', description: '打开搜索框', keys: ['Ctrl', 'K'] },
  { id: 'sendMessage', name: '发送消息', description: '发送当前输入的消息', keys: ['Enter'] },
  { id: 'newLine', name: '换行', description: '在输入框中换行', keys: ['Shift', 'Enter'] },
  { id: 'settings', name: '打开设置', description: '快速打开设置页面', keys: ['Ctrl', ','] },
  { id: 'closeWindow', name: '关闭窗口', description: '关闭当前窗口/对话框', keys: ['Esc'] },
  { id: 'toggleSidebar', name: '切换侧边栏', description: '显示/隐藏侧边栏', keys: ['Ctrl', 'B'] },
  { id: 'fullscreen', name: '全屏模式', description: '进入/退出全屏', keys: ['F11'] },
  { id: 'quickReply', name: '快速回复', description: '打开快速回复菜单', keys: ['Ctrl', 'R'] },
  { id: 'emoji', name: '表情面板', description: '打开表情选择面板', keys: ['Ctrl', 'E'] }
];

// 状态
const shortcuts = ref([...defaultShortcuts]);
const globalEnabled = ref(false);
const showHints = ref(true);
const saving = ref(false);
const recordingId = ref(null);
const showRecordDialog = ref(false);
const currentShortcut = ref(null);
const isRecording = ref(false);
const recordedKeys = ref([]);

// 检测冲突
const conflicts = computed(() => {
  const keyMap = {};
  const conflictList = [];
  
  shortcuts.value.forEach(s => {
    const keyStr = s.keys.sort().join('+');
    if (!keyMap[keyStr]) {
      keyMap[keyStr] = [];
    }
    keyMap[keyStr].push(s.name);
  });
  
  Object.entries(keyMap).forEach(([keys, items]) => {
    if (items.length > 1) {
      conflictList.push({ keys, items });
    }
  });
  
  return conflictList;
});

// 格式化按键显示
const formatKeys = (keys) => {
  return keys.map(key => {
    const keyMap = {
      'Ctrl': 'Ctrl',
      'Alt': 'Alt',
      'Shift': 'Shift',
      'Enter': '↵',
      'Esc': 'Esc',
      'Space': '␣',
      'ArrowUp': '↑',
      'ArrowDown': '↓',
      'ArrowLeft': '←',
      'ArrowRight': '→'
    };
    return keyMap[key] || key.toUpperCase();
  });
};

// 开始录制
const startRecording = (shortcut) => {
  currentShortcut.value = shortcut;
  recordingId.value = shortcut.id;
  recordedKeys.value = [];
  showRecordDialog.value = true;
  isRecording.value = true;
};

// 取消录制
const cancelRecording = () => {
  recordingId.value = null;
  currentShortcut.value = null;
  recordedKeys.value = [];
  showRecordDialog.value = false;
  isRecording.value = false;
};

// 确认录制
const confirmRecording = () => {
  if (recordedKeys.value.length >= 2 && currentShortcut.value) {
    const index = shortcuts.value.findIndex(s => s.id === currentShortcut.value.id);
    if (index !== -1) {
      shortcuts.value[index].keys = [...recordedKeys.value];
    }
    cancelRecording();
    ElMessage.success('快捷键已更新');
  }
};

// 处理键盘事件
const handleKeyDown = (e) => {
  if (!isRecording.value) return;
  
  e.preventDefault();
  e.stopPropagation();
  
  // Esc 取消
  if (e.key === 'Escape') {
    cancelRecording();
    return;
  }
  
  // Enter 确认
  if (e.key === 'Enter' && recordedKeys.value.length >= 2) {
    confirmRecording();
    return;
  }
  
  // 收集修饰键
  const keys = [];
  if (e.ctrlKey) keys.push('Ctrl');
  if (e.altKey) keys.push('Alt');
  if (e.shiftKey) keys.push('Shift');
  
  // 收集主键（非修饰键）
  const mainKey = e.key;
  if (!['Control', 'Alt', 'Shift', 'Meta'].includes(mainKey)) {
    keys.push(mainKey);
  }
  
  recordedKeys.value = keys;
};

// 加载设置
const loadSettings = () => {
  try {
    const saved = localStorage.getItem('shortcutSettings');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.shortcuts) {
        shortcuts.value = parsed.shortcuts;
      }
      globalEnabled.value = parsed.globalEnabled ?? false;
      showHints.value = parsed.showHints ?? true;
    }
  } catch (error) {
    console.error('加载快捷键设置失败:', error);
  }
};

// 保存设置
const saveShortcuts = async () => {
  saving.value = true;
  try {
    localStorage.setItem('shortcutSettings', JSON.stringify({
      shortcuts: shortcuts.value,
      globalEnabled: globalEnabled.value,
      showHints: showHints.value
    }));
    ElMessage.success('快捷键设置已保存');
  } catch (error) {
    ElMessage.error('保存设置失败');
  } finally {
    saving.value = false;
  }
};

// 重置为默认
const resetShortcuts = async () => {
  try {
    await ElMessageBox.confirm('确定要恢复默认快捷键设置吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    });
    shortcuts.value = [...defaultShortcuts];
    ElMessage.info('已恢复默认设置');
  } catch {
    // 用户取消
  }
};

// 解决冲突
const resolveConflicts = async () => {
  await ElMessageBox.confirm(
    '将自动为冲突的快捷键添加数字后缀，是否继续？',
    '解决冲突',
    {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'info'
    }
  );
  
  // 简单的冲突解决：给后面的快捷键添加修改键
  const used = new Set();
  shortcuts.value.forEach(s => {
    const keyStr = s.keys.sort().join('+');
    if (used.has(keyStr)) {
      // 添加 Alt 修饰
      if (!s.keys.includes('Alt')) {
        s.keys = ['Alt', ...s.keys];
      } else if (!s.keys.includes('Shift')) {
        s.keys = ['Shift', ...s.keys];
      }
    }
    used.add(s.keys.sort().join('+'));
  });
  
  ElMessage.success('冲突已解决');
};

// 全局开关变化
const handleGlobalChange = (val) => {
  if (val) {
    ElMessage.info('需要在系统设置中授予权限');
  }
};

// 提示开关变化
const handleShowHintsChange = () => {
  // 可以触发全局事件来更新界面显示
};

onMounted(() => {
  loadSettings();
  window.addEventListener('keydown', handleKeyDown);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown);
});
</script>

<style scoped>
.shortcut-settings {
  padding: 8px 0;
}

.setting-section {
  margin-bottom: 32px;
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--fenlin-text-primary, #2C3E50);
  margin-bottom: 8px;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(196, 30, 58, 0.1);
  display: flex;
  align-items: center;
  gap: 8px;
}

.section-desc {
  font-size: 13px;
  color: var(--fenlin-text-tertiary, #95A5A6);
  margin-bottom: 16px;
}

/* 快捷键列表 */
.shortcut-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.shortcut-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  background: var(--fenlin-surface, #FFFFFF);
  border: 1px solid rgba(196, 30, 58, 0.1);
  border-radius: var(--fenlin-radius-sm, 8px);
  transition: var(--fenlin-transition, all 0.3s cubic-bezier(0.4, 0, 0.2, 1));
}

.shortcut-item:hover {
  border-color: rgba(196, 30, 58, 0.3);
  background: linear-gradient(135deg, rgba(196, 30, 58, 0.02) 0%, rgba(212, 160, 23, 0.02) 100%);
}

.shortcut-item.recording {
  border-color: var(--fenlin-primary, #C41E3A);
  background: linear-gradient(135deg, rgba(196, 30, 58, 0.05) 0%, rgba(212, 160, 23, 0.05) 100%);
}

.shortcut-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.shortcut-name {
  font-weight: 500;
  color: var(--fenlin-text-primary, #2C3E50);
}

.shortcut-desc {
  font-size: 13px;
  color: var(--fenlin-text-tertiary, #95A5A6);
}

.shortcut-keys {
  display: flex;
  align-items: center;
  gap: 8px;
}

.key-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 28px;
  height: 28px;
  padding: 0 8px;
  background: var(--fenlin-bg-secondary, #F5F5F5);
  border: 1px solid var(--fenlin-border, #E0E0E0);
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  color: var(--fenlin-text-primary, #2C3E50);
  box-shadow: 0 2px 0 var(--fenlin-border, #E0E0E0);
}

.recording-hint {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--fenlin-primary, #C41E3A);
  font-size: 14px;
}

.recording-dot {
  width: 8px;
  height: 8px;
  background: var(--fenlin-primary, #C41E3A);
  border-radius: 50%;
  animation: pulse 1s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.shortcut-actions {
  margin-left: 12px;
}

/* 全局设置 */
.global-setting {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  background: var(--fenlin-surface, #FFFFFF);
  border: 1px solid rgba(196, 30, 58, 0.1);
  border-radius: var(--fenlin-radius-sm, 8px);
  margin-bottom: 12px;
}

.global-setting:last-child {
  margin-bottom: 0;
}

.setting-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.setting-name {
  font-weight: 500;
  color: var(--fenlin-text-primary, #2C3E50);
}

.setting-desc {
  font-size: 13px;
  color: var(--fenlin-text-tertiary, #95A5A6);
}

/* 冲突检测 */
.conflict-section {
  background: rgba(230, 57, 80, 0.05);
  border-radius: var(--fenlin-radius-md, 12px);
  padding: 16px;
  border: 1px solid rgba(196, 30, 58, 0.2);
}

.conflict-title {
  color: var(--fenlin-primary, #C41E3A);
}

.conflict-list {
  margin-bottom: 16px;
}

.conflict-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: var(--fenlin-surface, #FFFFFF);
  border-radius: var(--fenlin-radius-sm, 8px);
  margin-bottom: 8px;
}

.conflict-keys {
  font-family: monospace;
  font-weight: 600;
  color: var(--fenlin-primary, #C41E3A);
}

.conflict-items {
  font-size: 14px;
  color: var(--fenlin-text-secondary, #5A6C7D);
}

/* 录制对话框 */
.record-dialog-content {
  text-align: center;
}

.record-target {
  margin-bottom: 24px;
  font-size: 15px;
  color: var(--fenlin-text-primary, #2C3E50);
}

.record-target strong {
  color: var(--fenlin-primary, #C41E3A);
}

.record-area {
  padding: 32px;
  border: 2px dashed var(--fenlin-border, #E0E0E0);
  border-radius: var(--fenlin-radius-md, 12px);
  background: var(--fenlin-bg-secondary, #F5F5F5);
  transition: var(--fenlin-transition, all 0.3s cubic-bezier(0.4, 0, 0.2, 1));
  cursor: pointer;
}

.record-area:hover,
.record-area.active {
  border-color: var(--fenlin-primary, #C41E3A);
  background: linear-gradient(135deg, rgba(196, 30, 58, 0.05) 0%, rgba(212, 160, 23, 0.05) 100%);
}

.record-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.record-text {
  color: var(--fenlin-text-secondary, #5A6C7D);
}

.recorded-keys {
  display: flex;
  justify-content: center;
  gap: 8px;
}

.record-tip {
  margin-top: 16px;
  font-size: 12px;
  color: var(--fenlin-text-tertiary, #95A5A6);
  line-height: 1.8;
}

/* 操作按钮 */
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

/* 响应式 */
@media (max-width: 768px) {
  .shortcut-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }

  .shortcut-keys {
    width: 100%;
    justify-content: space-between;
  }
}
</style>

<!--
  通知设置组件
  @author 小琳
  @date 2026-03-04
-->
<template>
  <div class="notification-settings">
    <!-- 桌面通知 -->
    <div class="setting-section">
      <h3 class="section-title">桌面通知</h3>
      
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-name">启用桌面通知</span>
          <span class="setting-desc">收到新消息时显示系统通知</span>
        </div>
        <el-switch 
          v-model="settings.desktopEnabled" 
          @change="handleDesktopChange"
        />
      </div>

      <div v-if="settings.desktopEnabled" class="sub-settings">
        <div class="setting-item">
          <div class="setting-info">
            <span class="setting-name">显示消息预览</span>
            <span class="setting-desc">在通知中显示消息内容</span>
          </div>
          <el-switch v-model="settings.showPreview" />
        </div>

        <div class="setting-item">
          <div class="setting-info">
            <span class="setting-name">显示发送者头像</span>
            <span class="setting-desc">在通知中显示发送者的头像</span>
          </div>
          <el-switch v-model="settings.showAvatar" />
        </div>

        <div class="setting-item">
          <div class="setting-info">
            <span class="setting-name">通知停留时间</span>
            <span class="setting-desc">通知自动消失的时间（秒）</span>
          </div>
          <el-input-number
            v-model="settings.duration"
            :min="3"
            :max="30"
            :step="1"
            size="small"
          />
        </div>
      </div>

      <div v-if="notificationPermission === 'denied'" class="permission-warning">
        <el-alert
          type="warning"
          :closable="false"
          show-icon
        >
          <template #title>
            浏览器已禁止通知权限，请在浏览器设置中允许通知
          </template>
        </el-alert>
      </div>
    </div>

    <!-- 声音通知 -->
    <div class="setting-section">
      <h3 class="section-title">声音通知</h3>
      
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-name">启用声音提示</span>
          <span class="setting-desc">收到新消息时播放提示音</span>
        </div>
        <el-switch v-model="settings.soundEnabled" />
      </div>

      <div v-if="settings.soundEnabled" class="sub-settings">
        <div class="setting-item">
          <div class="setting-info">
            <span class="setting-name">提示音选择</span>
            <span class="setting-desc">选择你喜欢的提示音</span>
          </div>
          <el-select v-model="settings.soundType" size="small" style="width: 150px">
            <el-option
              v-for="sound in soundOptions"
              :key="sound.value"
              :label="sound.label"
              :value="sound.value"
            >
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span>{{ sound.label }}</span>
                <el-button
                  text
                  size="small"
                  @click.stop="playSound(sound.value)"       >
                  试听
                </el-button>
              </div>
            </el-option>
          </el-select>
        </div>

        <div class="setting-item">
          <div class="setting-info">
            <span class="setting-name">音量</span>
            <span class="setting-desc">调整提示音音量</span>
          </div>
          <div class="volume-control">
            <el-icon><Mute /></el-icon>
            <el-slider
              v-model="settings.volume"
              :min="0"
              :max="100"
              :step="5"
              style="width: 150px; margin: 0 12px"
            />
            <el-icon><Microphone /></el-icon>
          </div>
        </div>
      </div>
    </div>

    <!-- 免打扰 -->
    <div class="setting-section">
      <h3 class="section-title">免打扰模式</h3>
      
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-name">启用免打扰</span>
          <span class="setting-desc">在指定时间段内不接收通知</span>
        </div>
        <el-switch v-model="settings.dndEnabled" />
      </div>

      <div v-if="settings.dndEnabled" class="sub-settings">
        <div class="setting-item">
          <div class="setting-info">
            <span class="setting-name">免打扰时段</span>
            <span class="setting-desc">设置免打扰的起止时间</span>
          </div>
          <div class="time-range">
            <el-time-select
              v-model="settings.dndStart"
              :max-time="settings.dndEnd"
              placeholder="开始时间"
              start="00:00"
              step="00:30"
              end="23:30"
              size="small"
            />
            <span class="time-separator">至</span>
            <el-time-select
              v-model="settings.dndEnd"
              :min-time="settings.dndStart"
              placeholder="结束时间"
              start="00:00"
              step="00:30"
              end="23:30"
              size="small"
            />
          </div>
        </div>

        <div class="setting-item">
          <div class="setting-info">
            <span class="setting-name">重要消息例外</span>
            <span class="setting-desc">即使在免打扰时段也接收重要消息通知</span>
          </div>
          <el-switch v-model="settings.dndAllowImportant" />
        </div>
      </div>
    </div>

    <!-- 通知类型 -->
    <div class="setting-section">
      <h3 class="section-title">通知类型</h3>
      <p class="section-desc">选择你想接收的通知类型</p>
      
      <div class="notification-types">
        <div
          v-for="type in notificationTypes"
          :key="type.value"
          class="type-item"
        >
          <el-checkbox v-model="settings.types[type.value]">
            <div class="type-info">
              <span class="type-icon">{{ type.icon }}</span>
              <div class="type-text">
                <span class="type-name">{{ type.label }}</span>
                <span class="type-desc">{{ type.description }}</span>
              </div>
            </div>
          </el-checkbox>
        </div>
      </div>
    </div>

    <!-- 测试通知 -->
    <div class="setting-section test-section">
    <h3 class="section-title">测试通知</h3>
      <p class="section-desc">发送一条测试通知，检查设置是否生效</p>
      <el-button type="primary" @click="sendTestNotification">
        发送测试通知
      </el-button>
    </div>

    <!-- 操作按钮 -->
    <div class="setting-actions">
      <el-button @click="resetSettings">恢复默认</el-button>
      <el-button type="primary" :loading="saving" @click="saveSettings">保存设置</el-button>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Mute, Microphone } from '@element-plus/icons-vue';

// 通知权限状态
const notificationPermission = ref('default');

// 提示音选项
const soundOptions = [
  { value: 'default', label: '默认' },
  { value: 'ding', label: '叮咚' },
  { value: 'bell', label: '铃声' },
  { value: 'chime', label: '风铃' },
  { value: 'pop', label: '气泡' }
];

// 通知类型
const notificationTypes = [
  { value: 'message', label: '新消息', description: '收到新的聊天消息', icon: '💬' },
  { value: 'mention', label: '@提及', description: '有人@了你', icon: '📢' },
  { value: 'friend', label: '好友请求', description: '收到新的好友申请', icon: '👥' },
  { value: 'group', label: '群组邀请', description: '被邀请加入群组', icon: '👨‍👩‍👧‍👦' },
  { value: 'system', label: '系统通知', description: '系统消息和公告', icon: '🔔' }
];

// 设置状态
const saving = ref(false);
const settings = reactive({
  desktopEnabled: false,
  showPreview: true,
  showAvatar: true,
  duration: 5,
  soundEnabled: true,
  soundType: 'default',
  volume: 50,
  dndEnabled: false,
  dndStart: '22:00',
  dndEnd: '08:00',
  dndAllowImportant: true,
  types: {
    message: true,
    mention: true,
    friend: true,
    group: true,
    system: true
  }
});

// 默认设置
const defaultSettings = {
  desktopEnabled: false,
  showPreview: true,
  showAvatar: true,
  duration: 5,
  soundEnabled: true,
  soundType: 'default',
  volume: 50,
  dndEnabled: false,
  dndStart: '22:00',
  dndEnd: '08:00',
  dndAllowImportant: true,
  types: {
    message: true,
    mention: true,
    friend: true,
    group: true,
    system: true
  }
};

// 检查通知权限
const checkNotificationPermission = () => {
  if ('Notification' in window) {
    notificationPermission.value = Notification.permission;
  }
};

// 请求通知权限
const requestNotificationPermission = async () => {
  if ('Notification' in window && Notification.permission === 'default') {
    const permission = await Notification.requestPermission();
    notificationPermission.value = permission;
    return permission === 'granted';
  }
  return Notification.permission === 'granted';
};

// 处理桌面通知开关
const handleDesktopChange = async (val) => {
  if (val) {
    const granted = await requestNotificationPermission();
    if (!granted) {
      settings.desktopEnabled = false;
      ElMessage.warning('需要授予通知权限才能启用桌面通知');
    }
  }
};

// 播放提示音
const playSound = (soundType) => {
  // 这里可以实际播放音频文件
  const audio = new Audio(`/soundsoundType}.mp3`);
  audio.volume = settings.volume / 100;
  audio.play().catch(() => {
    ElMessage.info(`试听 ${soundType} 提示音`);
  });
};

// 发送测试通知
const sendTestNotification = async () => {
  if (!settings.desktopEnabled) {
    ElMessage.warning('请先启用桌面通知');
    return;
  }

  const granted = await requestNotificationPermission();
  if (!granted) {
    ElMessage.error('通知权限被拒绝');
    return;
  }

  // 播放声音
  if (settings.soundEnabled) {
    playSound(settings.soundType);
  }

  // 显示通知
  const notification = new Notification('枫琳', {
    body: settings.showPreview ? '这是一条测试通知消息 ✨' : '你收到了一条新消息',
    icon: settings.showAvatar ? '/logo.png' : undefined,
    tag: 'test-notification',
    requireInteraction: false
  });

  setTimeout(() => {
    notification.close();
  }, settings.duration * 1000);

  ElMessage.success('测试通知已发送');
};

// 加载设置
const loadSettings = () => {
  try {
    const saved = localStorage.getItem('notificationSettings');
    if (saved) {
      const parsed = JSON.parse(saved);
      Object.assign(settings, parsed);
    }
  } catch (error) {
    console.error('加载通知设置失败:', error);
  }
};

// 保存设置
const saveSettings = async () => {
  saving.value = true;
  try {
    localStorage.setItem('notificationSettings', JSON.stringify(settings));
    ElMessage.success('通知设置已保存');
  } catch (error) {
    ElMessage.error('保存设置失败');
  } finally {
    saving.value = false;
  }
};

// 恢复默认设置
const resetSettings = async () => {
  try {
    await ElMessageBox.confirm('确定要恢复默认通知设置吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    });
    Object.assign(settings, defaultSettings);
    ElMessage.info('已恢复默认设置');
  } catch {
    // 用户取消
  }
};

onMounted(() => {
  checkNotificationPermission();
  loadSettings();
});
</script>

<style scoped>
.notification-settings {
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
}

.section-desc {
  font-size: 13px;
  color: var(--fenlin-text-tertiary, #95A5A6);
  margin-bottom: 16px;
}

/* 设置项 */
.setting-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  background: var(--fenlin-surface, #FFFFFF);
  border: 1px solid rgba(196, 30, 58, 0.1);
  border-radius: var(--fenlin-radius-sm, 8px);
  margin-bottom: 12px;
  transition: var(--fenlin-transition, all 0.3s cubic-bezier(0.4, 0, 0.2, 1));
}

.setting-item:hover {
  border-color: rgba(196, 30, 58, 0.3);
  background: linear-gradient(135deg, rgba(196, 30, 58, 0.02) 0%, rgba(212, 160, 23, 0.02) 100%);
}

.setting-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
}

.setting-name {
  font-weight: 500;
  color: var(--fenlin-text-primary, #2C3E50);
}

.setting-desc {
  font-size: 13px;
  color: var(--fenlin-text-tertiary, #95A5A6);
}

/* 子设置 */
.sub-settings {
  margin-left: 24px;
  padding-left: 16px;
  border-left: 2px solid rgba(196, 30, 58, 0.2);
}

/* 权限警告 */
.permission-warning {
  margin-top: 16px;
}

/* 音量控制 */
.volume-control {
  display: flex;
  align-items: center;
  gap: 8px;
}

.volume-control .el-icon {
  color: var(--fenlin-text-tertiary, #95A5A6);
}

.volume-control :deep(.el-slider__runway) {
  height: 6px;
  border-radius: 3px;
}

.volume-control :deep(.el-slider__bar) {
  background: var(--fenlin-gradient-primary, linear-gradient(135deg, #C41E3A 0%, #100%));
}

.volume-control :deep(.el-slider__button) {
  width: 16px;
  height: 16px;
  border: 2px solid var(--fenlin-primary, #C41E3A);
}

/* 时间范围 */
.time-range {
  display: flex;
  align-items: center;
  gap: 12px;
}

.time-separator {
  color: var(--fenlin-text-tertiary, #95A5A6);
}

/* 通知类型 */
.notification-types {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.type-item {
  padding: 12px;
  background: var(--fenlin-surface, #FFFFFF);
  border: 1px solid rgba(196, 30, 58, 0.1);
  border-radius: var(--fenlin-radius-sm, 8px);
  transition: var(--fenlin-transition, all 0.3s cubic-bezier(0.4, 0, 0.2, 1));
}

.type-item:hover {
  border-color: rgba(196, 30, 58, 0.3);
  background: linear-gradient(135deg, rgba(196, 30, 58, 0.02) 0%, rgba(212, 160, 23, 0.02) 100%);
}

.type-item :deep(.el-checkbox) {
  width: 100%;
}

.type-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.type-icon {
  font-size: 24px;
}

.type-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.type-name {
  font-weight: 500;
  color: var(--fenlin-text-primary, #2C3E50);
}

.type-desc {
  font-size: 12px;
  color: var(--fenlin-text-tertiary, #95A5A6);
}

/* 测试区域 */
.test-section {
  background: linear-gradient(135deg, rgba(196, 30, 58, 0.05) 0%, rgba(212, 160, 23, 0.05) 100%);
  border-radius: var(--fenlin-radius-md, 12px);
  padding: 20px;
  border: 1px solid rgba(196, 30, 58, 0.2);
}

.test-section :deep(.el-button) {
  margin-top: 12px;
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
  .setting-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }

  .sub-settings {
    margin-left: 0;
    padding-left: 12px;
  }

  .time-range {
    flex-direction: column;
    align-items: stretch;
  }

  .time-separator {
    text-align: center;
  }

  .volume-control {
    width: 100%;
  }

  .volume-control :deep(.el-slider) {
    flex: 1;
  }

  .setting-actions {
 flex-direction: column;
  }

  .setting-actions :deep(.el-button) {
    width: 100%;
  }
}
</style>

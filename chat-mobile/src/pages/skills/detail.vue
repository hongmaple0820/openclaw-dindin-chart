<template>
  <view class="skill-detail-page">
    <!-- 头部 -->
    <view class="header">
      <view class="back-btn" @click="goBack">
        <text>‹ 返回</text>
      </view>
      <text class="title">技能详情</text>
      <view class="placeholder"></view>
    </view>
    
    <view v-if="loading" class="loading-state">
      <text>加载中...</text>
    </view>
    
    <scroll-view v-else-if="skill" class="content" scroll-y>
      <!-- 技能信息 -->
      <view class="skill-header">
        <view class="skill-icon">{{ skill.icon || '🔧' }}</view>
        <view class="skill-info">
          <text class="skill-name">{{ skill.name }}</text>
          <text class="skill-desc">{{ skill.description || '暂无描述' }}</text>
          <view class="skill-tags">
            <text class="tag" v-if="skill.version">v{{ skill.version }}</text>
            <text class="tag" v-if="skill.category">{{ skill.category }}</text>
            <text class="tag installed" v-if="skill.installed">已安装</text>
          </view>
        </view>
      </view>
      
      <!-- 基本信息 -->
      <view class="section">
        <text class="section-title">基本信息</text>
        <view class="info-list">
          <view class="info-item">
            <text class="label">技能 ID</text>
            <text class="value">{{ skill.id }}</text>
          </view>
          <view class="info-item">
            <text class="label">类型</text>
            <text class="value">{{ getTypeLabel(skill.type) }}</text>
          </view>
          <view class="info-item" v-if="skill.author">
            <text class="label">作者</text>
            <text class="value">{{ skill.author }}</text>
          </view>
          <view class="info-item" v-if="skill.installedAt">
            <text class="label">安装时间</text>
            <text class="value">{{ formatDate(skill.installedAt) }}</text>
          </view>
        </view>
      </view>
      
      <!-- 配置 -->
      <view class="section" v-if="skill.installed && skill.config">
        <text class="section-title">配置</text>
        <view class="config-list">
          <view class="config-item" v-for="(value, key) in skill.config" :key="key">
            <text class="config-label">{{ key }}</text>
            <input 
              class="config-input" 
              :value="value" 
              @blur="updateConfig(key, $event.detail.value)"
            />
          </view>
        </view>
      </view>
      
      <!-- 使用示例 -->
      <view class="section" v-if="skill.examples && skill.examples.length > 0">
        <text class="section-title">使用示例</text>
        <view class="example-list">
          <view class="example-item" v-for="(example, index) in skill.examples" :key="index">
            <text class="example-title">{{ example.title }}</text>
            <text class="example-desc">{{ example.description }}</text>
            <view class="example-command">
              <text>{{ example.command }}</text>
            </view>
          </view>
        </view>
      </view>
    </scroll-view>
    
    <!-- 底部操作 -->
    <view class="actions" v-if="skill">
      <view v-if="!skill.installed" class="install-btn" @click="handleInstall">
        <text>安装技能</text>
      </view>
      <view v-else class="action-row">
        <view :class="['toggle-btn', { enabled: skill.enabled }]" @click="handleToggle">
          <text>{{ skill.enabled ? '禁用' : '启用' }}</text>
        </view>
        <view class="uninstall-btn" @click="handleUninstall">
          <text>卸载</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useSkillStore } from '@/stores/skills'
import { Skill } from '@/api/skills'

const skillStore = useSkillStore

const skill = ref<Skill | null>(null)
const loading = ref(true)

onMounted(async () => {
  const pages = getCurrentPages()
  const currentPage = pages[pages.length - 1] as any
  const skillId = currentPage?.options?.id
  
  if (skillId) {
    try {
      skill.value = await skillStore.fetchSkillDetail(skillId)
    } catch (error) {
      uni.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      loading.value = false
    }
  } else {
    loading.value = false
  }
})

function goBack() {
  uni.navigateBack()
}

function getTypeLabel(type: string): string {
  switch (type) {
    case 'built-in': return '内置'
    case 'market': return '市场'
    case 'custom': return '自定义'
    default: return type
  }
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString('zh-CN')
}

async function handleInstall() {
  if (!skill.value) return
  
  uni.showLoading({ title: '安装中...' })
  try {
    const res = await skillStore.installSkill(skill.value.id)
    if (res.success) {
      skill.value.installed = true
      uni.showToast({ title: '安装成功', icon: 'success' })
    } else {
      uni.showToast({ title: res.error || '安装失败', icon: 'none' })
    }
  } finally {
    uni.hideLoading()
  }
}

async function handleToggle() {
  if (!skill.value) return
  
  try {
    const newStatus = !skill.value.enabled
    const res = await skillStore.toggleSkillEnabled(skill.value.id, newStatus)
    if (res.success) {
      skill.value.enabled = newStatus
      uni.showToast({ title: newStatus ? '已启用' : '已禁用', icon: 'success' })
    }
  } catch (error) {
    uni.showToast({ title: '操作失败', icon: 'none' })
  }
}

async function handleUninstall() {
  if (!skill.value) return
  
  const [, result] = await uni.showModal({
    title: '确认卸载',
    content: `确定要卸载技能 "${skill.value.name}" 吗？`
  })
  
  if (result) {
    uni.showLoading({ title: '卸载中...' })
    try {
      const res = await skillStore.uninstallSkill(skill.value.id)
      if (res.success) {
        uni.showToast({ title: '已卸载', icon: 'success' })
        setTimeout(() => {
          uni.navigateBack()
        }, 1500)
      }
    } finally {
      uni.hideLoading()
    }
  }
}

async function updateConfig(key: string, value: any) {
  if (!skill.value) return
  
  const config = { ...(skill.value.config || {}), [key]: value }
  await skillStore.updateSkillConfig(skill.value.id, config)
}
</script>

<style lang="scss" scoped>
.skill-detail-page {
  min-height: 100vh;
  background-color: #f5f7fa;
  display: flex;
  flex-direction: column;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20rpx 30rpx;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.back-btn {
  font-size: 28rpx;
  color: #fff;
}

.title {
  font-size: 32rpx;
  font-weight: bold;
  color: #fff;
}

.placeholder {
  width: 60rpx;
}

.loading-state {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #999;
  font-size: 28rpx;
}

.content {
  flex: 1;
  padding: 20rpx 30rpx;
}

.skill-header {
  display: flex;
  background-color: #fff;
  border-radius: 16rpx;
  padding: 30rpx;
  margin-bottom: 20rpx;
}

.skill-icon {
  width: 100rpx;
  height: 100rpx;
  border-radius: 20rpx;
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 50rpx;
  flex-shrink: 0;
}

.skill-info {
  flex: 1;
  margin-left: 24rpx;
}

.skill-name {
  font-size: 36rpx;
  font-weight: bold;
  color: #333;
  display: block;
  margin-bottom: 8rpx;
}

.skill-desc {
  font-size: 26rpx;
  color: #666;
  display: block;
  margin-bottom: 12rpx;
}

.skill-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 10rpx;
}

.tag {
  font-size: 22rpx;
  padding: 4rpx 12rpx;
  background-color: #f5f5f5;
  color: #666;
  border-radius: 20rpx;
  
  &.installed {
    background-color: #e8f5e9;
    color: #4caf50;
  }
}

.section {
  background-color: #fff;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 20rpx;
}

.section-title {
  font-size: 30rpx;
  font-weight: 500;
  color: #333;
  margin-bottom: 20rpx;
  display: block;
}

.info-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.info-item {
  display: flex;
  justify-content: space-between;
  padding: 12rpx 0;
  border-bottom: 1rpx solid #f5f5f5;
  
  &:last-child {
    border-bottom: none;
  }
}

.label {
  font-size: 26rpx;
  color: #999;
}

.value {
  font-size: 26rpx;
  color: #333;
}

.config-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.config-item {
  display: flex;
  align-items: center;
}

.config-label {
  width: 200rpx;
  font-size: 26rpx;
  color: #666;
}

.config-input {
  flex: 1;
  height: 60rpx;
  padding: 0 16rpx;
  background-color: #f5f7fa;
  border-radius: 8rpx;
  font-size: 26rpx;
}

.example-list {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.example-item {
  padding: 20rpx;
  background-color: #f5f7fa;
  border-radius: 12rpx;
}

.example-title {
  font-size: 28rpx;
  font-weight: 500;
  color: #333;
  display: block;
  margin-bottom: 8rpx;
}

.example-desc {
  font-size: 24rpx;
  color: #666;
  display: block;
  margin-bottom: 12rpx;
}

.example-command {
  padding: 12rpx 16rpx;
  background-color: #e8e8e8;
  border-radius: 8rpx;
  font-family: monospace;
  font-size: 24rpx;
  color: #333;
}

.actions {
  padding: 20rpx 30rpx;
  background-color: #fff;
  border-top: 1rpx solid #eee;
}

.install-btn {
  height: 88rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 44rpx;
  font-size: 30rpx;
  color: #fff;
}

.action-row {
  display: flex;
  gap: 20rpx;
}

.toggle-btn,
.uninstall-btn {
  flex: 1;
  height: 88rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 44rpx;
  font-size: 28rpx;
}

.toggle-btn {
  background-color: #eee;
  color: #999;
  
  &.enabled {
    background-color: #e8f5e9;
    color: #4caf50;
  }
}

.uninstall-btn {
  background-color: #ffebee;
  color: #f44336;
}
</style>
<template>
  <view class="skills-page">
    <!-- 头部 -->
    <view class="header">
      <text class="title">技能管理</text>
    </view>
    
    <!-- Tab 切换 -->
    <view class="tabs">
      <view 
        v-for="tab in tabs" 
        :key="tab.value"
        :class="['tab-item', { active: currentTab === tab.value }]"
        @click="switchTab(tab.value)"
      >
        <text>{{ tab.label }}</text>
        <view class="badge" v-if="getCountByTab(tab.value)">{{ getCountByTab(tab.value) }}</view>
      </view>
    </view>
    
    <!-- 搜索栏 -->
    <view class="search-bar">
      <input 
        v-model="searchQuery" 
        placeholder="搜索技能..." 
        class="search-input"
        @confirm="handleSearch"
      />
    </view>
    
    <!-- 技能列表 -->
    <scroll-view class="skills-list" scroll-y @scrolltolower="loadMore">
      <view v-if="loading" class="loading-state">
        <text>加载中...</text>
      </view>
      
      <view v-else-if="currentSkills.length === 0" class="empty-state">
        <text class="empty-text">暂无技能</text>
      </view>
      
      <view 
        v-else
        v-for="skill in currentSkills" 
        :key="skill.id" 
        class="skill-card"
        @click="goToDetail(skill.id)"
      >
        <view class="skill-icon">{{ skill.icon || '🔧' }}</view>
        <view class="skill-info">
          <view class="skill-name">
            <text>{{ skill.name }}</text>
            <text v-if="skill.installed" class="installed-badge">已安装</text>
          </view>
          <text class="skill-desc">{{ skill.description || '暂无描述' }}</text>
          <view class="skill-meta">
            <text class="category" v-if="skill.category">{{ skill.category }}</text>
            <text class="version" v-if="skill.version">v{{ skill.version }}</text>
          </view>
        </view>
        <view class="skill-actions">
          <view 
            v-if="skill.installed" 
            :class="['toggle-btn', { enabled: skill.enabled }]"
            @click.stop="toggleSkill(skill)"
          >
            {{ skill.enabled ? '启用' : '禁用' }}
          </view>
          <view v-else class="install-btn" @click.stop="installSkill(skill.id)">
            安装
          </view>
        </view>
      </view>
    </scroll-view>
    
    <!-- 分类筛选弹窗 -->
    <view class="filter-bar" @click="showCategoryFilter = true">
      <text>分类筛选</text>
      <text class="filter-value" v-if="categoryFilter">{{ categoryFilter }}</text>
    </view>
    
    <!-- 分类选择器 -->
    <uni-popup ref="categoryPopup" type="bottom">
      <view class="category-picker">
        <view class="picker-header">
          <text @click="showCategoryFilter = false">取消</text>
          <text class="picker-title">选择分类</text>
          <text @click="confirmCategory">确定</text>
        </view>
        <scroll-view scroll-y class="picker-list">
          <view 
            class="picker-item"
            :class="{ active: tempCategory === '' }"
            @click="tempCategory = ''"
          >
            全部分类
          </view>
          <view 
            v-for="cat in categories" 
            :key="cat"
            class="picker-item"
            :class="{ active: tempCategory === cat }"
            @click="tempCategory = cat"
          >
            {{ cat }}
          </view>
        </scroll-view>
      </view>
    </uni-popup>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useSkillStore } from '@/stores/skills'
import { Skill } from '@/api/skills'

const skillStore = useSkillStore

const currentTab = ref('built-in')
const searchQuery = ref('')
const categoryFilter = ref('')
const showCategoryFilter = ref(false)
const tempCategory = ref('')
const categoryPopup = ref()
const loading = ref(false)

const tabs = [
  { label: '内置技能', value: 'built-in' },
  { label: '我的技能', value: 'my' },
  { label: '技能市场', value: 'market' }
]

const currentSkills = computed(() => {
  switch (currentTab.value) {
    case 'built-in':
      return skillStore.state.builtInSkills
    case 'my':
      return skillStore.state.mySkills
    case 'market':
      return skillStore.state.marketSkills
    default:
      return []
  }
})

const categories = computed(() => skillStore.state.categories)

function getCountByTab(tab: string): number {
  switch (tab) {
    case 'built-in':
      return skillStore.state.builtInSkills.length
    case 'my':
      return skillStore.state.mySkills.length
    case 'market':
      return skillStore.state.marketSkills.length
    default:
      return 0
  }
}

async function switchTab(tab: string) {
  currentTab.value = tab
  loading.value = true
  try {
    await skillStore.fetchSkills(tab)
  } finally {
    loading.value = false
  }
}

async function handleSearch() {
  loading.value = true
  try {
    await skillStore.fetchSkills(currentTab.value)
  } finally {
    loading.value = false
  }
}

async function toggleSkill(skill: Skill) {
  try {
    const newStatus = !skill.enabled
    const res = await skillStore.toggleSkillEnabled(skill.id, newStatus)
    if (res.success) {
      skill.enabled = newStatus
      uni.showToast({ title: newStatus ? '已启用' : '已禁用', icon: 'success' })
    }
  } catch (error) {
    uni.showToast({ title: '操作失败', icon: 'none' })
  }
}

async function installSkill(skillId: string) {
  uni.showLoading({ title: '安装中...' })
  try {
    const res = await skillStore.installSkill(skillId)
    if (res.success) {
      uni.showToast({ title: '安装成功', icon: 'success' })
      await skillStore.fetchSkills(currentTab.value)
    } else {
      uni.showToast({ title: res.error || '安装失败', icon: 'none' })
    }
  } catch (error) {
    uni.showToast({ title: '安装失败', icon: 'none' })
  } finally {
    uni.hideLoading()
  }
}

function goToDetail(skillId: string) {
  uni.navigateTo({
    url: `/pages/skills/detail?id=${skillId}`
  })
}

async function confirmCategory() {
  categoryFilter.value = tempCategory.value
  showCategoryFilter.value = false
  await handleSearch()
}

async function loadMore() {
  // 分页加载逻辑（可选）
}

onMounted(async () => {
  loading.value = true
  try {
    await Promise.all([
      skillStore.fetchSkills('built-in'),
      skillStore.fetchCategories()
    ])
  } finally {
    loading.value = false
  }
})
</script>

<style lang="scss" scoped>
.skills-page {
  min-height: 100vh;
  background-color: #f5f7fa;
  display: flex;
  flex-direction: column;
}

.header {
  padding: 40rpx 30rpx;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.title {
  font-size: 40rpx;
  font-weight: bold;
  color: #fff;
}

.tabs {
  display: flex;
  background-color: #fff;
  border-bottom: 1rpx solid #eee;
}

.tab-item {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24rpx 0;
  font-size: 28rpx;
  color: #666;
  position: relative;
  
  &.active {
    color: #667eea;
    font-weight: 500;
    
    &::after {
      content: '';
      position: absolute;
      bottom: 0;
      left: 50%;
      transform: translateX(-50%);
      width: 40rpx;
      height: 4rpx;
      background-color: #667eea;
      border-radius: 2rpx;
    }
  }
}

.badge {
  margin-left: 8rpx;
  padding: 2rpx 10rpx;
  font-size: 22rpx;
  background-color: #667eea;
  color: #fff;
  border-radius: 20rpx;
}

.search-bar {
  padding: 20rpx 30rpx;
  background-color: #fff;
}

.search-input {
  width: 100%;
  height: 70rpx;
  padding: 0 24rpx;
  background-color: #f5f7fa;
  border-radius: 35rpx;
  font-size: 28rpx;
}

.skills-list {
  flex: 1;
  padding: 20rpx 30rpx;
}

.loading-state,
.empty-state {
  text-align: center;
  padding: 100rpx 0;
  color: #999;
  font-size: 28rpx;
}

.skill-card {
  display: flex;
  align-items: center;
  background-color: #fff;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 20rpx;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.04);
}

.skill-icon {
  width: 80rpx;
  height: 80rpx;
  border-radius: 16rpx;
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 40rpx;
  flex-shrink: 0;
}

.skill-info {
  flex: 1;
  margin-left: 20rpx;
  overflow: hidden;
}

.skill-name {
  display: flex;
  align-items: center;
  font-size: 30rpx;
  font-weight: 500;
  color: #333;
  margin-bottom: 8rpx;
}

.installed-badge {
  margin-left: 10rpx;
  font-size: 22rpx;
  padding: 2rpx 10rpx;
  background-color: #e8f5e9;
  color: #4caf50;
  border-radius: 4rpx;
}

.skill-desc {
  font-size: 24rpx;
  color: #999;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-bottom: 8rpx;
}

.skill-meta {
  display: flex;
  gap: 16rpx;
}

.category,
.version {
  font-size: 22rpx;
  color: #667eea;
  background-color: rgba(102, 126, 234, 0.1);
  padding: 4rpx 12rpx;
  border-radius: 20rpx;
}

.skill-actions {
  margin-left: 20rpx;
}

.toggle-btn,
.install-btn {
  padding: 12rpx 24rpx;
  font-size: 24rpx;
  border-radius: 30rpx;
}

.install-btn {
  background-color: #667eea;
  color: #fff;
}

.toggle-btn {
  background-color: #eee;
  color: #999;
  
  &.enabled {
    background-color: #e8f5e9;
    color: #4caf50;
  }
}

.filter-bar {
  padding: 20rpx 30rpx;
  background-color: #fff;
  border-top: 1rpx solid #eee;
  display: flex;
  align-items: center;
  font-size: 28rpx;
  color: #666;
}

.filter-value {
  margin-left: 10rpx;
  color: #667eea;
}

.category-picker {
  background-color: #fff;
  border-radius: 24rpx 24rpx 0 0;
}

.picker-header {
  display: flex;
  justify-content: space-between;
  padding: 24rpx 30rpx;
  border-bottom: 1rpx solid #eee;
  font-size: 28rpx;
  color: #667eea;
}

.picker-title {
  font-weight: 500;
  color: #333;
}

.picker-list {
  max-height: 600rpx;
}

.picker-item {
  padding: 24rpx 30rpx;
  font-size: 28rpx;
  border-bottom: 1rpx solid #f5f5f5;
  
  &.active {
    color: #667eea;
    background-color: rgba(102, 126, 234, 0.05);
  }
}
</style>
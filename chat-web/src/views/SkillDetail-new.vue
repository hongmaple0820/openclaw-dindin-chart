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
      <div class="header-actions">
        <el-button
          v-if="skillStore.currentSkill?.installed"
          type="primary"
          size="small"
          :icon="skillStore.currentSkill?.enabled ? SwitchButton : VideoPlay"
          @click="handleToggle"
        >
          {{ skillStore.currentSkill?.enabled ? '禁用' : '启用' }}
        </el-button>
      </div>
    </div>
    
    <div v-if="skillStore.detailLoading" class="loading-state">
      <el-icon class="is-loading"><Loading /></el-icon>
      <span>加载中...</span>
    </div>
    
    <div v-else-if="skillStore.currentSkill" class="detail-content">
      <!-- 技能头部 -->
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
            <el-tag size="small" :type="getTypeTagType(skillStore.currentSkill.type)">
              {{ getTypeLabel(skillStore.currentSkill.type) }}
            </el-tag>
          </div>
          <div class="skill-desc">
            {{ skillStore.currentSkill.description || '暂无描述' }}
          </div>
        </div>
      </div>
      
      <!-- Tab 内容 -->
      <el-tabs v-model="activeTab" class="detail-tabs">
        <el-tab-pane label="基本信息" name="info">
          <el-descriptions :column="1" border>
            <el-descriptions-item label="技能 ID">
              <code class="inline-code">{{ skillStore.currentSkill.id }}</code>
            </el-descriptions-item>
            <el-descriptions-item label="版本">
              v{{ skillStore.currentSkill.version || '1.0.0' }}
            </el-descriptions-item>
            <el-descriptions-item label="分类">
              {{ skillStore.currentSkill.category || '未分类' }}
            </el-descriptions-item>
            <el-descriptions-item v-if="skillStore.currentSkill.author" label="作者">
              {{ skillStore.currentSkill.author }}
            </el-descriptions-item>
            <el-descriptions-item v-if="skillStore.currentSkill.downloads" label="下载量">
              {{ formatNumber(skillStore.currentSkill.downloads) }}
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
            @save="handleSaveConfig"
          />
        </el-tab-pane>
        
        <el-tab-pane label="使用示例" name="examples" v-if="skillStore.currentSkill.examples?.length">
          <div class="examples-section">
            <div v-for="(example, index) in skillStore.currentSkill.examples" :key="index" class="example-item">
              <div class="example-title">{{ example.title }}</div>
              <div class="example-desc">{{ example.description }}</div>
              <div class="example-command-wrapper">
                <code class="example-command-text">{{ example.command }}</code>
                <el-button
                  text
                  :icon="CopyDocument"
                  @click="copyCommand(example.command)"
                  size="small"
                >
                  复制
                </el-button>
              </div>
            </div>
          </div>
        </el-tab-pane>
      </el-tabs>
      
      <!-- 底部操作按钮 -->
      <div class="action-buttons">
        <el-button
          v-if="!skillStore.currentSkill.installed"
          type="primary"
          size="large"
          block
          @click="handleInstall"
          :loading="installing"
        >
          <el-icon><Download /></el-icon>
          安装技能
        </el-button>
        <template v-else>
          <el-button
            type="danger"
            size="large"
            block
            @click="handleUninstall"
            :loading="uninstalling"
          >
            <el-icon><Delete /></el-icon>
            卸载技能
          </el-button>
        </template>
      </div>
    </div>
    
    <div v-else class="empty-state">
      <el-empty description="技能不

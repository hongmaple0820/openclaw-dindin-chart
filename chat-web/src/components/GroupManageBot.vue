<!--
  机器人管理组件
  @author 小琳
  @date 2026-03-03
-->
<template>
  <div class="bot-management">
    <div class="section-header">
      <span class="title">群机器人</span>
      <el-button type="primary" size="small" @click="showAddBot = true">
        <el-icon><Plus /></el-icon>
        添加机器人
      </el-button>
    </div>

    <!-- 机器人列表 -->
    <div class="bot-list" v-if="bots.length > 0">
      <div v-for="bot in bots" :key="bot.id" class="bot-item">
        <div class="bot-info">
          <el-avatar :size="40" :src="bot.avatar">
            🤖
          </el-avatar>
          <div class="bot-detail">
            <span class="bot-name">{{ bot.name }}</span>
            <span class="bot-desc">{{ bot.description || '暂无描述' }}</span>
          </div>
        </div>
        <div class="bot-actions">
          <el-switch
            v-model="bot.enabled"
            @change="handleToggleBot(bot)"
            active-text="启用"
            inactive-text="禁用"
          />
          <el-button
            type="danger"
            size="small"
            text
            @click="handleRemoveBot(bot)"
          >
            移除
          </el-button>
        </div>
      </div>
    </div>

    <el-empty v-else description="暂无机器人" />

    <!-- 添加机器人对话框 -->
    <el-dialog
      v-model="showAddBot"
      title="添加机器人"
      width="500px"
    >
      <div class="available-bots">
        <div
          v-for="bot in availableBots"
          :key="bot.id"
          class="available-bot-item"
          :class="{ disabled: addedBotIds.includes(bot.id) }"
          @click="!addedBotIds.includes(bot.id) && handleAddBot(bot)"
        >
          <el-avatar :size="40" :src="bot.avatar">🤖</el-avatar>
          <div class="bot-info">
            <span class="bot-name">{{ bot.name }}</span>
            <span class="bot-desc">{{ bot.description }}</span>
          </div>
          <el-icon v-if="addedBotIds.includes(bot.id)" class="added-icon"><Check /></el-icon>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { Plus, Check } from '@element-plus/icons-vue';
import { ElMessage, ElMessageBox } from 'element-plus';

const props = defineProps({
  bots: {
    type: Array,
    default: () => []
  },
  availableBots: {
    type: Array,
    default: () => []
  }
});

const emit = defineEmits(['addBot', 'removeBot', 'toggleBot']);

const showAddBot = ref(false);

const addedBotIds = computed(() => props.bots.map(b => b.id));

async function handleAddBot(bot) {
  try {
    emit('addBot', bot);
    showAddBot.value = false;
  } catch (error) {
    console.error('添加机器人失败:', error);
  }
}

async function handleRemoveBot(bot) {
  try {
    await ElMessageBox.confirm(
      `确定要将机器人「${bot.name}」从群聊中移除吗？`,
      '移除机器人',
      { type: 'warning' }
    );
    emit('removeBot', bot);
  } catch {
    // 取消
  }
}

async function handleToggleBot(bot) {
  emit('toggleBot', bot);
}
</script>

<style scoped>
.bot-management {
  padding: 16px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.section-header .title {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}

.bot-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.bot-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  background: #f5f7fa;
  border-radius: 8px;
}

.bot-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.bot-detail {
  display: flex;
  flex-direction: column;
}

.bot-name {
  font-weight: 500;
  color: #303133;
}

.bot-desc {
  font-size: 13px;
  color: #909399;
}

.bot-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.available-bots {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: 400px;
  overflow-y: auto;
}

.available-bot-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.available-bot-item:hover:not(.disabled) {
  border-color: #C41E3A;
  background: #fff7f7;
}

.available-bot-item.disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.available-bot-item .bot-info {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.added-icon {
  color: #67c23a;
  font-size: 20px;
}
</style>
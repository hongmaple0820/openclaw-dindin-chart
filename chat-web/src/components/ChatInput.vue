<!--
  聊天输入组件 - 支持 @ 成员
  @author 小琳
  @date 2026-03-07
-->
<template>
  <div class="chat-input">
    <div class="input-container">
      <!-- @ 成员标签 -->
      <div v-if="selectedMembers.length > 0" class="mention-tags">
        <el-tag
          v-for="member in selectedMembers"
          :key="member.id"
          closable
          size="small"
          :type="member.type === 'all' ? 'warning' : ''"
          @close="removeMember(member)"
        >
          @{{ member.name }}
        </el-tag>
      </div>
      
      <!-- 输入框 -->
      <el-input
        ref="inputRef"
        v-model="inputText"
        type="textarea"
        :rows="1"
        :autosize="{ minRows: 1, maxRows: 4 }"
        :placeholder="placeholder"
        @keydown.enter="handleKeyDown"
        @input="handleInput"
      />
    </div>
    
    <!-- 操作按钮 -->
    <div class="input-actions">
      <!-- @ 按钮 -->
      <el-popover
        v-model:visible="showMentionPopover"
        placement="top"
        :width="300"
        trigger="click"
      >
        <template #reference>
          <el-button :icon="User" circle :type="showMentionPopover ? 'primary' : ''" />
        </template>
        
        <!-- 成员选择 -->
        <div class="member-selector">
          <el-input
            v-model="memberSearch"
            placeholder="搜索成员..."
            size="small"
            clearable
            :prefix-icon="Search"
          />
          
          <div class="member-list">
            <!-- @ 全部 -->
            <div
              v-if="enableAtAll"
              class="member-item all"
              @click="selectMember({ id: 'all', name: '全部成员', type: 'all' })"
            >
              <el-icon><UserFilled /></el-icon>
              <span>@全部成员</span>
            </div>
            
            <!-- 好友分组 -->
            <div v-if="friends.length > 0" class="member-group">
              <div class="group-title">
                <el-icon><User /></el-icon>
                我的好友
              </div>
              <div
                v-for="friend in filteredFriends"
                :key="friend.id"
                class="member-item"
                @click="selectMember({ id: friend.id, name: friend.remark || friend.nickname, type: 'friend', avatar: friend.avatar })"
              >
                <el-avatar :size="24" :src="friend.avatar">
                  {{ friend.nickname?.[0] }}
                </el-avatar>
                <span>{{ friend.remark || friend.nickname }}</span>
              </div>
            </div>
            
            <!-- 我的智能体分组 -->
            <div v-if="myAgents.length > 0" class="member-group">
              <div class="group-title">
                <el-icon><Cpu /></el-icon>
                我的智能体
              </div>
              <div
                v-for="agent in filteredMyAgents"
                :key="agent.id"
                class="member-item"
                @click="selectMember({ id: agent.id, name: agent.name, type: 'agent', avatar: agent.avatar })"
              >
                <el-avatar :size="24" :src="agent.avatar">
                  {{ agent.name?.[0] }}
                </el-avatar>
                <span>{{ agent.name }}</span>
              </div>
            </div>
            
            <!-- 公开智能体分组 -->
            <div v-if="publicAgents.length > 0" class="member-group">
              <div class="group-title">
                <el-icon><Collection /></el-icon>
                公开智能体
              </div>
              <div
                v-for="agent in filteredPublicAgents"
                :key="agent.id"
                class="member-item"
                @click="selectMember({ id: agent.id, name: agent.name, type: 'public_agent', avatar: agent.avatar })"
              >
                <el-avatar :size="24" :src="agent.avatar">
                  {{ agent.name?.[0] }}
                </el-avatar>
                <span>{{ agent.name }}</span>
              </div>
            </div>
            
            <el-empty v-if="isEmpty" description="暂无可选成员" :image-size="40" />
          </div>
        </div>
      </el-popover>
      
      <!-- 发送按钮 -->
      <el-button type="primary" :loading="loading" :disabled="!canSend" @click="handleSend">
        {{ sendText }}
      </el-button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { User, UserFilled, Cpu, Collection, Search } from '@element-plus/icons-vue';

const props = defineProps({
  modelValue: {
    type: String,
    default: ''
  },
  placeholder: {
    type: String,
    default: '输入消息，@ 成员...'
  },
  loading: {
    type: Boolean,
    default: false
  },
  sendText: {
    type: String,
    default: '发送'
  },
  friends: {
    type: Array,
    default: () => []
  },
  myAgents: {
    type: Array,
    default: () => []
  },
  publicAgents: {
    type: Array,
    default: () => []
  },
  enableAtAll: {
    type: Boolean,
    default: true
  }
});

const emit = defineEmits(['update:modelValue', 'send', 'mention-change']);

const inputRef = ref(null);
const inputText = ref(props.modelValue);
const showMentionPopover = ref(false);
const memberSearch = ref('');
const selectedMembers = ref([]);

// 筛选后的成员列表
const filteredFriends = computed(() => {
  if (!memberSearch.value) return props.friends.slice(0, 5);
  return props.friends.filter(f =>
    (f.remark || f.nickname).toLowerCase().includes(memberSearch.value.toLowerCase())
  ).slice(0, 5);
});

const filteredMyAgents = computed(() => {
  if (!memberSearch.value) return props.myAgents.slice(0, 5);
  return props.myAgents.filter(a =>
    a.name.toLowerCase().includes(memberSearch.value.toLowerCase())
  ).slice(0, 5);
});

const filteredPublicAgents = computed(() => {
  if (!memberSearch.value) return props.publicAgents.slice(0, 5);
  return props.publicAgents.filter(a =>
    a.name.toLowerCase().includes(memberSearch.value.toLowerCase())
  ).slice(0, 5);
});

const isEmpty = computed(() => {
  return filteredFriends.value.length === 0 &&
         filteredMyAgents.value.length === 0 &&
         filteredPublicAgents.value.length === 0;
});

const canSend = computed(() => {
  return inputText.value.trim() || selectedMembers.value.length > 0;
});

// 同步 v-model
watch(() => props.modelValue, (val) => {
  inputText.value = val;
});

watch(inputText, (val) => {
  emit('update:modelValue', val);
});

watch(selectedMembers, (val) => {
  emit('mention-change', val);
}, { deep: true });

function selectMember(member) {
  if (!selectedMembers.value.find(m => m.id === member.id)) {
    selectedMembers.value.push(member);
  }
  showMentionPopover.value = false;
  memberSearch.value = '';
  inputRef.value?.focus();
}

function removeMember(member) {
  selectedMembers.value = selectedMembers.value.filter(m => m.id !== member.id);
}

function handleKeyDown(e) {
  if (e.shiftKey) return;
  e.preventDefault();
  handleSend();
}

function handleInput(val) {
  // 检测 @ 符号
  if (val.includes('@') && !showMentionPopover.value) {
    showMentionPopover.value = true;
  }
}

function handleSend() {
  if (!canSend.value || props.loading) return;
  
  let content = inputText.value.trim();
  if (selectedMembers.value.length > 0) {
    const mentions = selectedMembers.value.map(m => `@${m.name}`).join(' ');
    content = mentions + (content ? ' ' + content : '');
  }
  
  emit('send', {
    content,
    mentions: [...selectedMembers.value],
    text: inputText.value.trim()
  });
  
  // 清空输入
  inputText.value = '';
  selectedMembers.value = [];
}

// 暴露方法
defineExpose({
  focus: () => inputRef.value?.focus(),
  clear: () => {
    inputText.value = '';
    selectedMembers.value = [];
  }
});
</script>

<style scoped>
.chat-input {
  display: flex;
  gap: 12px;
  align-items: flex-end;
}

.input-container {
  flex: 1;
  background: #f5f7fa;
  border-radius: 8px;
  padding: 8px 12px;
}

.mention-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 8px;
}

.input-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* 成员选择器 */
.member-selector {
  max-height: 300px;
}

.member-list {
  max-height: 220px;
  overflow-y: auto;
  margin-top: 8px;
}

.member-group {
  margin-top: 8px;
}

.group-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #909399;
  padding: 8px 0 4px;
}

.member-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  transition: background 0.2s;
}

.member-item:hover {
  background: #f5f7fa;
}

.member-item.all {
  background: #fdf6ec;
  color: #e6a23c;
}

.member-item.all:hover {
  background: #faecd8;
}
</style>
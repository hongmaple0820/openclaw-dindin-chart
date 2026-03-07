<!--
  群聊列表页面
  @author 小琳
  @date 2026-03-03
-->
<template>
  <div class="groups-page">
    <div class="groups-container">
      <!-- 左侧群聊列表 -->
      <div class="group-list-panel">
        <div class="panel-header">
          <span class="header-title">群聊</span>
          <el-button type="primary" size="small" @click="router.push('/groups/create')">
            <el-icon><Plus /></el-icon>
            创建
          </el-button>
        </div>

        <!-- 搜索 -->
        <div class="search-area">
          <el-input
            v-model="searchQuery"
            placeholder="搜索群聊"
            :prefix-icon="Search"
            clearable
            size="small"
          />
        </div>

        <!-- 群聊列表 -->
        <div class="group-list" v-loading="groupStore.loading">
          <GroupItem
            v-for="group in filteredGroups"
            :key="group.id"
            :group="group"
            :active="currentGroupId === group.id"
            @click="selectGroup(group)"
          />

          <el-empty v-if="filteredGroups.length === 0 && !groupStore.loading" description="暂无群聊" />
        </div>
      </div>

      <!-- 右侧群详情/聊天区域 -->
      <div class="group-detail-panel">
        <template v-if="currentGroup">
          <GroupDetail
            :group-id="currentGroup.id"
            @settings="router.push(`/groups/${currentGroup.id}/settings`)"
          />
        </template>
        <template v-else>
          <div class="empty-state">
            <el-empty description="选择一个群聊开始聊天" />
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { Plus, Search } from '@element-plus/icons-vue';
import { useGroupStore } from '@/stores/groups';
import GroupItem from '@/components/GroupItem.vue';
import GroupDetail from '@/views/GroupDetail.vue';

const router = useRouter();
const route = useRoute();
const groupStore = useGroupStore();

const searchQuery = ref('');
const currentGroupId = ref(null);

const currentGroup = computed(() => 
  groupStore.groups.find(g => g.id === currentGroupId.value)
);

const filteredGroups = computed(() => {
  if (!searchQuery.value) return groupStore.groups;
  const query = searchQuery.value.toLowerCase();
  return groupStore.groups.filter(g => 
    g.name.toLowerCase().includes(query)
  );
});

function selectGroup(group) {
  currentGroupId.value = group.id;
  router.push({ query: { id: group.id } });
}

onMounted(async () => {
  await groupStore.fetchGroups();
  
  // 从 URL 获取群 ID
  const groupId = route.query.id;
  if (groupId) {
    currentGroupId.value = Number(groupId) || groupId;
  }
});
</script>

<style scoped>
.groups-page {
  height: calc(100vh - 56px);
  padding: 0;
}

.groups-container {
  display: flex;
  height: 100%;
  background: #fff;
  overflow: hidden;
}

.group-list-panel {
  width: 280px;
  border-right: 1px solid #e4e7ed;
  display: flex;
  flex-direction: column;
}

.panel-header {
  padding: 12px 16px;
  border-bottom: 1px solid #e4e7ed;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-title {
  font-size: 15px;
  font-weight: 600;
  color: #303133;
}

.search-area {
  padding: 8px 12px;
  border-bottom: 1px solid #e4e7ed;
}

.group-list {
  flex: 1;
  overflow-y: auto;
  padding: 4px 0;
}

.group-detail-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.empty-state {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
}

@media (max-width: 768px) {
  .groups-page {
    padding: 0;
  }

  .groups-container {
    flex-direction: column;
  }

  .group-list-panel {
    width: 100%;
    height: 50%;
    border-right: none;
    border-bottom: 1px solid #e4e7ed;
  }

  .group-detail-panel {
    height: 50%;
  }
}
</style>
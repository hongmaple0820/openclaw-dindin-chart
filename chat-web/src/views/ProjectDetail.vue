<!--
  项目群详情页面
  @author 小琳
  @date 2026-03-03
-->
<template>
  <div class="project-detail" v-loading="loading">
    <template v-if="project">
      <!-- 头部信息 -->
      <div class="detail-header">
        <div class="header-left">
          <h2>{{ project.name }}</h2>
          <el-tag :type="statusMap[project.status]?.type || 'info'" size="small">
            {{ statusMap[project.status]?.label || project.status }}
          </el-tag>
        </div>
        <div class="header-right">
          <el-button @click="activeTab = 'tasks'" :type="activeTab === 'tasks' ? 'primary' : 'default'">
            <el-icon><List /></el-icon>
            任务看板
          </el-button>
          <el-button @click="activeTab = 'skills'" :type="activeTab === 'skills' ? 'primary' : 'default'">
            <el-icon><MagicStick /></el-icon>
            技能管理
          </el-button>
          <el-dropdown trigger="click">
            <el-button>
              <el-icon><More /></el-icon>
            </el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item @click="editProject">编辑项目</el-dropdown-item>
                <el-dropdown-item @click="showMembers = true">管理成员</el-dropdown-item>
                <el-dropdown-item divided @click="confirmDelete">删除项目</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </div>

      <!-- 项目描述 -->
      <div class="detail-info">
        <p class="description">{{ project.description || '暂无描述' }}</p>
        <div class="meta-info">
          <span class="meta-item">
            <el-icon><User /></el-icon>
            {{ project.owner?.nickname || project.owner?.username || '未知' }}
          </span>
          <span class="meta-item">
            <el-icon><Calendar /></el-icon>
            {{ formatDate(project.createdAt) }}
          </span>
          <span class="meta-item">
            <el-icon><UserFilled /></el-icon>
            {{ memberCount }} 成员
          </span>
        </div>
      </div>

      <!-- 标签页内容 -->
      <div class="detail-content">
        <ProjectTasks v-if="activeTab === 'tasks'" :project-id="projectId" />
        <ProjectSkills v-else-if="activeTab === 'skills'" :project-id="projectId" />
      </div>

      <!-- 成员管理弹窗 -->
      <el-dialog v-model="showMembers" title="项目成员" width="500px">
        <div class="member-list">
          <div v-for="member in members" :key="member.id" class="member-item">
            <el-avatar :size="32" :src="member.user?.avatar">
              {{ member.user?.nickname?.[0] || member.user?.username?.[0] }}
            </el-avatar>
            <div class="member-info">
              <span class="name">{{ member.user?.nickname || member.user?.username }}</span>
              <el-tag size="small" v-if="member.role">{{ member.role }}</el-tag>
            </div>
            <el-button
              v-if="member.userId !== project.ownerId"
              type="danger"
              size="small"
              text
              @click="handleRemoveMember(member.userId)"
            >
              移除
            </el-button>
          </div>
        </div>
        <template #footer>
          <el-button @click="showInviteMember = true">邀请成员</el-button>
        </template>
      </el-dialog>

      <!-- 邀请成员弹窗 -->
      <el-dialog v-model="showInviteMember" title="邀请成员" width="400px">
        <el-input
          v-model="inviteUserId"
          placeholder="输入用户ID"
          @keyup.enter="handleInviteMember"
        />
        <template #footer>
          <el-button @click="showInviteMember = false">取消</el-button>
          <el-button type="primary" @click="handleInviteMember">邀请</el-button>
        </template>
      </el-dialog>
    </template>

    <el-empty v-else-if="!loading" description="项目不存在" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { List, MagicStick, More, User, Calendar, UserFilled } from '@element-plus/icons-vue';
import { useProjectStore } from '@/stores/projects';
import ProjectTasks from './ProjectTasks.vue';
import ProjectSkills from './ProjectSkills.vue';

const props = defineProps({
  projectId: {
    type: [String, Number],
    required: true
  }
});

const router = useRouter();
const projectStore = useProjectStore();

const activeTab = ref('tasks');
const showMembers = ref(false);
const showInviteMember = ref(false);
const inviteUserId = ref('');

const project = computed(() => projectStore.currentProject);
const members = computed(() => projectStore.currentMembers);
const loading = computed(() => projectStore.loading);
const memberCount = computed(() => members.value.length);

const statusMap = {
  active: { label: '进行中', type: 'success' },
  completed: { label: '已完成', type: 'info' },
  paused: { label: '已暂停', type: 'warning' }
};

function formatDate(date) {
  if (!date) return '';
  return new Date(date).toLocaleDateString('zh-CN');
}

async function loadProjectData() {
  await projectStore.fetchProjectDetail(props.projectId);
  await projectStore.fetchMembers(props.projectId);
}

function editProject() {
  router.push(`/projects/${props.projectId}/edit`);
}

async function confirmDelete() {
  try {
    await ElMessageBox.confirm('确定要删除这个项目吗？此操作不可恢复。', '删除项目', {
      type: 'warning'
    });
    const success = await projectStore.deleteProject(props.projectId);
    if (success) {
      ElMessage.success('项目已删除');
      router.push('/projects');
    }
  } catch {
    // 取消删除
  }
}

async function handleInviteMember() {
  if (!inviteUserId.value) return;
  const success = await projectStore.addMember(props.projectId, inviteUserId.value);
  if (success) {
    ElMessage.success('邀请成功');
    showInviteMember.value = false;
    inviteUserId.value = '';
  }
}

async function handleRemoveMember(userId) {
  try {
    await ElMessageBox.confirm('确定要移除该成员吗？', '移除成员', { type: 'warning' });
    const success = await projectStore.removeMember(props.projectId, userId);
    if (success) {
      ElMessage.success('已移除');
    }
  } catch {
    // 取消
  }
}

watch(() => props.projectId, loadProjectData, { immediate: true });
</script>

<style scoped>
.project-detail {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.detail-header {
  padding: 20px;
  border-bottom: 1px solid #e4e7ed;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-left h2 {
  margin: 0;
  font-size: 20px;
  color: #303133;
}

.header-right {
  display: flex;
  gap: 8px;
}

.detail-info {
  padding: 16px 20px;
  border-bottom: 1px solid #e4e7ed;
}

.description {
  margin: 0 0 12px;
  color: #606266;
  font-size: 14px;
}

.meta-info {
  display: flex;
  gap: 16px;
  color: #909399;
  font-size: 13px;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

.detail-content {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.member-list {
  max-height: 400px;
  overflow-y: auto;
}

.member-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid #f0f0f0;
}

.member-item:last-child {
  border-bottom: none;
}

.member-info {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
}

.member-info .name {
  font-size: 14px;
  color: #303133;
}
</style>

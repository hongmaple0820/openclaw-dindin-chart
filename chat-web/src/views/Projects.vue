<!--
  项目群列表页面
  @author 小琳
  @date 2026-03-03
-->
<template>
  <div class="projects-page">
    <div class="projects-container">
      <!-- 左侧项目列表 -->
      <div class="project-list-panel">
        <div class="panel-header">
          <h3>项目群</h3>
          <el-button type="primary" size="small" @click="router.push('/projects/create')">
            <el-icon><Plus /></el-icon>
            创建项目
          </el-button>
        </div>

        <!-- 搜索和筛选 -->
        <div class="filter-area">
          <el-input
            v-model="searchQuery"
            placeholder="搜索项目"
            :prefix-icon="Search"
            clearable
            class="search-input"
          />
          <el-select v-model="statusFilter" placeholder="状态" clearable size="small" class="status-select">
            <el-option label="进行中" value="active" />
            <el-option label="已完成" value="completed" />
            <el-option label="已暂停" value="paused" />
          </el-select>
        </div>

        <!-- 项目列表 -->
        <div class="project-list" v-loading="projectStore.loading">
          <ProjectItem
            v-for="project in filteredProjects"
            :key="project.id"
            :project="project"
            :active="currentProjectId === project.id"
            @click="selectProject(project)"
          />

          <el-empty v-if="filteredProjects.length === 0 && !projectStore.loading" description="暂无项目" />
        </div>
      </div>

      <!-- 右侧项目详情 -->
      <div class="project-detail-panel">
        <template v-if="currentProject">
          <ProjectDetail :project-id="currentProject.id" />
        </template>
        <template v-else>
          <div class="empty-state">
            <el-empty description="选择一个项目查看详情">
              <el-button type="primary" @click="router.push('/projects/create')">
                创建新项目
              </el-button>
            </el-empty>
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
import { useProjectStore } from '@/stores/projects';
import ProjectItem from '@/components/ProjectItem.vue';
import ProjectDetail from '@/views/ProjectDetail.vue';

const router = useRouter();
const route = useRoute();
const projectStore = useProjectStore();

const searchQuery = ref('');
const statusFilter = ref('');
const currentProjectId = ref(null);

const currentProject = computed(() => 
  projectStore.projects.find(p => p.id === currentProjectId.value)
);

const filteredProjects = computed(() => {
  let result = projectStore.projects;
  
  // 状态筛选
  if (statusFilter.value) {
    result = result.filter(p => p.status === statusFilter.value);
  }
  
  // 搜索筛选
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    result = result.filter(p => 
      p.name.toLowerCase().includes(query) ||
      p.description?.toLowerCase().includes(query)
    );
  }
  
  return result;
});

function selectProject(project) {
  currentProjectId.value = project.id;
  router.push({ query: { id: project.id } });
}

onMounted(async () => {
  await projectStore.fetchProjects();
  
  // 从 URL 获取项目 ID
  const projectId = route.query.id;
  if (projectId) {
    currentProjectId.value = Number(projectId) || projectId;
  }
});
</script>

<style scoped>
.projects-page {
  height: calc(100vh - 120px);
  padding: 20px;
}

.projects-container {
  display: flex;
  height: 100%;
  background: #fff;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
}

.project-list-panel {
  width: 320px;
  border-right: 1px solid #e4e7ed;
  display: flex;
  flex-direction: column;
}

.panel-header {
  padding: 16px;
  border-bottom: 1px solid #e4e7ed;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.panel-header h3 {
  margin: 0;
  font-size: 16px;
  color: #303133;
}

.filter-area {
  padding: 12px 16px;
  border-bottom: 1px solid #e4e7ed;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.search-input {
  width: 100%;
}

.status-select {
  width: 100%;
}

.project-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
}

.project-detail-panel {
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
  .projects-page {
    padding: 12px;
  }

  .projects-container {
    flex-direction: column;
  }

  .project-list-panel {
    width: 100%;
    height: 50%;
    border-right: none;
    border-bottom: 1px solid #e4e7ed;
  }

  .project-detail-panel {
    height: 50%;
  }
}
</style>

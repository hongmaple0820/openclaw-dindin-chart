<!--
  项目群技能管理页面
  @author 小琳
  @date 2026-03-03
-->
<template>
  <div class="project-skills">
    <!-- 工具栏 -->
    <div class="skills-toolbar">
      <div class="toolbar-left">
        <el-input
          v-model="searchQuery"
          placeholder="搜索技能"
          :prefix-icon="Search"
          clearable
          style="width: 200px"
        />
        <el-select v-model="typeFilter" placeholder="类型" clearable size="small" style="width: 120px">
          <el-option label="规则" value="rule" />
          <el-option label="工具" value="tool" />
          <el-option label="工作流" value="workflow" />
        </el-select>
      </div>
      <div class="toolbar-right">
        <el-button type="primary" @click="showCreateSkill = true">
          <el-icon><Plus /></el-icon>
          添加技能
        </el-button>
      </div>
    </div>

    <!-- 技能列表 -->
    <div class="skills-content" v-loading="loading">
      <div class="skills-grid">
        <SkillItem
          v-for="skill in filteredSkills"
          :key="skill.id"
          :skill="skill"
          @edit="handleEditSkill"
          @delete="handleDeleteSkill"
        />
      </div>

      <el-empty v-if="filteredSkills.length === 0 && !loading" description="暂无技能" />
    </div>

    <!-- 创建/编辑技能弹窗 -->
    <el-dialog
      v-model="showCreateSkill"
      :title="editingSkill ? '编辑技能' : '添加技能'"
      width="500px"
    >
      <el-form :model="skillForm" label-width="80px">
        <el-form-item label="名称" required>
          <el-input v-model="skillForm.name" placeholder="技能名称" />
        </el-form-item>
        <el-form-item label="类型" required>
          <el-select v-model="skillForm.type" placeholder="选择类型">
            <el-option label="规则" value="rule" />
            <el-option label="工具" value="tool" />
            <el-option label="工作流" value="workflow" />
          </el-select>
        </el-form-item>
        <el-form-item label="描述">
          <el-input
            v-model="skillForm.description"
            type="textarea"
            :rows="3"
            placeholder="技能描述"
          />
        </el-form-item>
        <el-form-item label="配置">
          <el-input
            v-model="skillForm.config"
            type="textarea"
            :rows="4"
            placeholder="JSON 格式配置"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="closeSkillDialog">取消</el-button>
        <el-button type="primary" @click="handleSaveSkill" :loading="saving">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus, Search } from '@element-plus/icons-vue';
import { useProjectStore } from '@/stores/projects';
import SkillItem from '@/components/SkillItem.vue';

const props = defineProps({
  projectId: {
    type: [String, Number],
    required: true
  }
});

const projectStore = useProjectStore();

const searchQuery = ref('');
const typeFilter = ref('');
const showCreateSkill = ref(false);
const editingSkill = ref(null);
const saving = ref(false);

const skillForm = ref({
  name: '',
  type: 'tool',
  description: '',
  config: ''
});

const skills = computed(() => projectStore.currentSkills);
const loading = computed(() => projectStore.loading);

const filteredSkills = computed(() => {
  let result = skills.value;
  
  if (typeFilter.value) {
    result = result.filter(s => s.type === typeFilter.value);
  }
  
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    result = result.filter(s => 
      s.name.toLowerCase().includes(query) ||
      s.description?.toLowerCase().includes(query)
    );
  }
  
  return result;
});

function resetForm() {
  skillForm.value = {
    name: '',
    type: 'tool',
    description: '',
    config: ''
  };
  editingSkill.value = null;
}

function closeSkillDialog() {
  showCreateSkill.value = false;
  resetForm();
}

function handleEditSkill(skill) {
  editingSkill.value = skill;
  skillForm.value = {
    name: skill.name,
    type: skill.type,
    description: skill.description || '',
    config: skill.config ? JSON.stringify(skill.config, null, 2) : ''
  };
  showCreateSkill.value = true;
}

async function handleDeleteSkill(skill) {
  try {
    await ElMessageBox.confirm('确定要删除这个技能吗？', '删除技能', { type: 'warning' });
    const success = await projectStore.deleteSkill(props.projectId, skill.id);
    if (success) {
      ElMessage.success('技能已删除');
    }
  } catch {
    // 取消
  }
}

async function handleSaveSkill() {
  if (!skillForm.value.name || !skillForm.value.type) {
    ElMessage.warning('请填写必填项');
    return;
  }

  saving.value = true;
  
  try {
    const data = {
      name: skillForm.value.name,
      type: skillForm.value.type,
      description: skillForm.value.description,
      config: skillForm.value.config ? JSON.parse(skillForm.value.config) : null
    };

    let success;
    if (editingSkill.value) {
      success = await projectStore.updateSkill(props.projectId, editingSkill.value.id, data);
    } else {
      const result = await projectStore.createSkill(props.projectId, data);
      success = !!result;
    }

    if (success) {
      ElMessage.success(editingSkill.value ? '技能已更新' : '技能已创建');
      closeSkillDialog();
    }
  } catch (err) {
    ElMessage.error('保存失败: ' + err.message);
  } finally {
    saving.value = false;
  }
}

async function loadData() {
  await projectStore.fetchSkills(props.projectId);
}

watch(() => props.projectId, loadData, { immediate: true });
</script>

<style scoped>
.project-skills {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.skills-toolbar {
  padding: 12px 16px;
  border-bottom: 1px solid #e4e7ed;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.toolbar-left {
  display: flex;
  gap: 8px;
}

.skills-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.skills-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}
</style>

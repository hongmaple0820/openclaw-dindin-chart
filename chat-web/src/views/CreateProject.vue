<!--
  创建项目群页面
  @author 小琳
  @date 2026-03-03
-->
<template>
  <div class="create-project-page">
    <div class="page-header">
      <h2>创建项目群</h2>
    </div>

    <div class="form-container">
      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-width="100px"
        @submit.prevent="handleSubmit"
      >
        <el-form-item label="项目名称" prop="name">
          <el-input v-model="form.name" placeholder="输入项目名称" maxlength="50" show-word-limit />
        </el-form-item>

        <el-form-item label="项目描述" prop="description">
          <el-input
            v-model="form.description"
            type="textarea"
            :rows="4"
            placeholder="描述项目的目标和范围"
            maxlength="500"
            show-word-limit
          />
        </el-form-item>

        <el-form-item label="项目状态" prop="status">
          <el-select v-model="form.status" placeholder="选择状态">
            <el-option label="进行中" value="active" />
            <el-option label="已暂停" value="paused" />
          </el-select>
        </el-form-item>

        <el-form-item label="可见性" prop="visibility">
          <el-radio-group v-model="form.visibility">
            <el-radio value="private">私有</el-radio>
            <el-radio value="public">公开</el-radio>
          </el-radio-group>
          <div class="form-tip">
            私有项目仅成员可见，公开项目所有人可见
          </div>
        </el-form-item>

        <el-form-item label="初始化看板">
          <el-checkbox v-model="createDefaultBoards">
            创建默认看板列（待办、进行中、审核中、已完成）
          </el-checkbox>
        </el-form-item>

        <el-form-item>
          <el-button type="primary" native-type="submit" :loading="loading">
            创建项目
          </el-button>
          <el-button @click="router.back()">取消</el-button>
        </el-form-item>
      </el-form>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { useProjectStore } from '@/stores/projects';

const router = useRouter();
const projectStore = useProjectStore();

const formRef = ref(null);
const loading = ref(false);
const createDefaultBoards = ref(true);

const form = reactive({
  name: '',
  description: '',
  status: 'active',
  visibility: 'private'
});

const rules = {
  name: [
    { required: true, message: '请输入项目名称', trigger: 'blur' },
    { min: 2, max: 50, message: '名称长度为 2-50 个字符', trigger: 'blur' }
  ]
};

async function handleSubmit() {
  try {
    await formRef.value.validate();
  } catch {
    return;
  }

  loading.value = true;

  try {
    const project = await projectStore.createProject({
      name: form.name,
      description: form.description,
      status: form.status,
      visibility: form.visibility
    });

    if (project) {
      ElMessage.success('项目创建成功');
      
      // 如果选择了创建默认看板
      if (createDefaultBoards.value && project.id) {
        const defaultBoards = [
          { name: '待办', order: 0 },
          { name: '进行中', order: 1 },
          { name: '审核中', order: 2 },
          { name: '已完成', order: 3 }
        ];
        
        for (const board of defaultBoards) {
          await projectStore.createBoard(project.id, board);
        }
      }
      
      router.push(`/projects?id=${project.id}`);
    }
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.create-project-page {
  padding: 20px;
  max-width: 600px;
  margin: 0 auto;
}

.page-header {
  margin-bottom: 24px;
}

.page-header h2 {
  margin: 0;
  font-size: 20px;
  color: #303133;
}

.form-container {
  background: #fff;
  padding: 24px;
  border-radius: 8px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
}

.form-tip {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
}
</style>

<!--
  创建任务弹窗组件
  @author 小琳
  @date 2026-03-03
-->
<template>
  <el-dialog
    :model-value="modelValue"
    @update:model-value="$emit('update:modelValue', $event)"
    title="新建任务"
    width="500px"
  >
    <el-form ref="formRef" :model="form" :rules="rules" label-width="80px">
      <el-form-item label="标题" prop="title">
        <el-input v-model="form.title" placeholder="任务标题" maxlength="100" show-word-limit />
      </el-form-item>

      <el-form-item label="描述">
        <el-input
          v-model="form.description"
          type="textarea"
          :rows="3"
          placeholder="任务描述"
          maxlength="500"
        />
      </el-form-item>

      <el-form-item label="看板列" prop="boardId">
        <el-select v-model="form.boardId" placeholder="选择看板列" style="width: 100%">
          <el-option
            v-for="board in boards"
            :key="board.id"
            :label="board.name"
            :value="board.id"
          />
        </el-select>
      </el-form-item>

      <el-form-item label="优先级">
        <el-select v-model="form.priority" placeholder="选择优先级" style="width: 100%">
          <el-option label="高" value="high" />
          <el-option label="中" value="medium" />
          <el-option label="低" value="low" />
        </el-select>
      </el-form-item>

      <el-form-item label="截止日期">
        <el-date-picker
          v-model="form.dueDate"
          type="date"
          placeholder="选择截止日期"
          style="width: 100%"
        />
      </el-form-item>

      <el-form-item label="负责人">
        <el-input v-model="form.assigneeId" placeholder="用户ID（可选）" />
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="$emit('update:modelValue', false)">取消</el-button>
      <el-button type="primary" @click="handleSubmit" :loading="loading">创建</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, reactive, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { useProjectStore } from '@/stores/projects';

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  projectId: {
    type: [String, Number],
    required: true
  },
  boards: {
    type: Array,
    default: () => []
  }
});

const emit = defineEmits(['update:modelValue', 'created']);

const projectStore = useProjectStore();
const formRef = ref(null);
const loading = ref(false);

const form = reactive({
  title: '',
  description: '',
  boardId: '',
  priority: 'medium',
  dueDate: null,
  assigneeId: ''
});

const rules = {
  title: [
    { required: true, message: '请输入任务标题', trigger: 'blur' }
  ],
  boardId: [
    { required: true, message: '请选择看板列', trigger: 'change' }
  ]
};

// 重置表单
watch(() => props.modelValue, (val) => {
  if (val) {
    // 默认选择第一个看板
    if (props.boards.length > 0 && !form.boardId) {
      form.boardId = props.boards[0].id;
    }
  }
});

async function handleSubmit() {
  try {
    await formRef.value.validate();
  } catch {
    return;
  }

  loading.value = true;

  try {
    const data = {
      title: form.title,
      description: form.description,
      boardId: form.boardId,
      priority: form.priority,
      dueDate: form.dueDate?.toISOString() || null,
      assigneeId: form.assigneeId || null
    };

    const task = await projectStore.createTask(props.projectId, data);
    if (task) {
      ElMessage.success('任务创建成功');
      emit('created', task);
      emit('update:modelValue', false);
      resetForm();
    }
  } finally {
    loading.value = false;
  }
}

function resetForm() {
  form.title = '';
  form.description = '';
  form.boardId = props.boards[0]?.id || '';
  form.priority = 'medium';
  form.dueDate = null;
  form.assigneeId = '';
}
</script>

<style scoped>
.el-select {
  width: 100%;
}
</style>

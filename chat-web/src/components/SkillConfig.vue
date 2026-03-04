<!--
  技能配置表单组件
  @author 小琳
  @date 2026-03-04
-->
<template>
  <div class="skill-config">
    <div v-if="loading" class="loading-state">
      <el-icon class="is-loading"><Loading /></el-icon>
      <span>加载配置...</span>
    </div>
    
    <template v-else>
      <el-form
        ref="formRef"
        :model="formData"
        :rules="rules"
        label-position="top"
        class="config-form"
      >
        <template v-for="field in configFields" :key="field.key">
          <!-- 文本输入 -->
          <el-form-item
            v-if="field.type === 'text' || field.type === 'string'"
            :label="field.label"
            :prop="field.key"
            :required="field.required"
          >
            <el-input
              v-model="formData[field.key]"
              :placeholder="field.placeholder || `请输入${field.label}`"
              :maxlength="field.maxLength"
              show-word-limit
              clearable
            />
            <div v-if="field.description" class="field-desc">
              {{ field.description }}
            </div>
          </el-form-item>
          
          <!-- 数字输入 -->
          <el-form-item
            v-else-if="field.type === 'number' || field.type === 'integer'"
            :label="field.label"
            :prop="field.key"
            :required="field.required"
          >
            <el-input-number
              v-model="formData[field.key]"
              :placeholder="field.placeholder"
              :min="field.min"
              :max="field.max"
              :step="field.step || 1"
              :precision="field.type === 'integer' ? 0 : undefined"
              style="width: 100%"
            />
            <div v-if="field.description" class="field-desc">
           {{ field.description }}
            </div>
          </el-form-item>
          
          <!-- 布尔开关 -->
          <el-form-item
            v-else-if="field.type === 'boolean'"
            :label="field.label"
            :prop="field.key"
          >
            <el-switch
              v-model="formData[field.key]"
              :active-text="field.activeText || '开启'"
              :inactive-text="field.inactiveText || '关闭'"
            />
            <div v-if="field.description" class="field-desc">
              {{ field.description }}
            </div>
          </el-form-item>
          
          <!-- 下拉选择 -->
          <el-form-item
            v-else-if="field.type === 'select' || field.type === 'enum'"
            :label="field.label"
            :prop="field.key"
            :required="field.required"
          >
            <el-select
              v-model="formData[field.key]"
              :placeholder="field.placeholder || `请选择${field.label}`"
              style="width: 100%"
              clearable
            >
              <el-option
                v-for="option in field.options"
                :key="option.value"
                :label="option.label"
                :value="option.value"
              />
            </el-select>
            <div v-if="field.description" class="field-desc">
              {{ field.description }}
            </div>
          </el-form-item>
          
          <!-- 多行文本 -->
          <el-form-item
            v-else-if="field.type === 'textarea'"
            :label="field.label"
            :prop="field.key"
            :required="field.required"
          >
            <el-input
              v-model="formData[field.key]"
              type="textarea"
              :placeholder="field.placeholder"
              :rows="field.rows || 4"
              :maxlength="field.maxLength"
              show-word-limit
            />
            <div v-if="field.description" class="field-desc">
              {{ field.description }}
            </div>
          </el-form-item>
        </template>
        
        <el-form-item>
          <el-button type="primary" @click="handleSave" :loading="saving">
            保存配置
          </el-button>
          <el-button @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>
      
      <div v-if="configFields.length === 0" class="empty-config">
        <el-empty description="该技能无需配置" :image-size="80" />
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { Loading } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';

const props = defineProps({
  skill: {
    type: Object,
    required: true
  },
  config: {
    type: Object,
    default: () => ({})
  },
  loading: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['save', 'reset']);

const formRef = ref(null);
const formData = ref({});
const saving = ref(false);

const configFields = computed(() => {
  return props.skill.configSchema?.fields || [];
});

const rules = computed(() => {
  const r = {};
  configFields.value.forEach(field => {
    if (field.required) {
      r[field.key] = [
        { required: true, message: `请输入${field.label}`, trigger: 'blur' }
      ];
    }
  });
  return r;
});

function initFormData() {
  formData.value = { ...props.config };
  configFields.value.forEach(field => {
    if (formData.value[field.key] === undefined && field.default !== undefined) {
      formData.value[field.key] = field.default;
    }
  });
}

async function handleSave() {
  try {
    await formRef.value.validate();
    saving.value = true;
    emit('save', { ...formData.value });
  } catch (e) {
    ElMessage.warning('请检查表单填写是否正确');
  } finally {
    saving.value = false;
  }
}

function handleReset() {
  initFormData();
  emit('reset');
}

watch(() => props.config, () => {
  initFormData();
}, { immediate: true, deep: true });

onMounted(() => {
  initFormData();
});
</script>

<style scoped>
.skill-config {
  padding: 0;
}

.loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 40px;
  color: var(--fenlin-text-tertiary, #95A5A6);
}

.config-form {
  max-width: 100%;
}

.field-desc {
  margin-top: 4px;
  font-size: 12px;
  color: var(--fenlin-text-tertiary, #95A5A6);
}

.empty-config {
  padding: 20px;
}
</style>

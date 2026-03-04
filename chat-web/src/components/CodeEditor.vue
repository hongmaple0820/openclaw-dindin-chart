<!--
  代码编辑器组件
  @author 小琳
  @date 2026-03-04
-->
<template>
  <div class="code-editor">
    <div class="editor-header">
      <div class="file-info">
        <el-icon><Document /></el-icon>
        <span>{{ fileName }}</span>
        <el-tag v-if="modified" type="warning" size="small">未保存</el-tag>
      </div>
      <div class="editor-actions">
        <el-button size="small" @click="handleFormat">格式化</el-button>
        <el-button size="small" type="primary" @click="handleSave" :loading="saving">
          保存
        </el-button>
      </div>
    </div>
    <div class="editor-container">
      <textarea
        ref="editorRef"
        v-model="content"
        class="editor-textarea"
        @input="handleInput"
        :placeholder="placeholder"
      ></textarea>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue';
import { Document } from '@element-plus/icons-vue';

const props = defineProps({
  modelValue: {
    type: String,
    default: ''
  },
  fileName: {
    type: String,
    default: '未命名'
  },
  language: {
    type: String,
    default: 'javascript'
  },
  placeholder: {
    type: String,
    default: '请输入代码...'
  }
});

const emit = defineEmits(['update:modelValue', 'save']);

const editorRef = ref();
const content = ref(props.modelValue);
const modified = ref(false);
const saving = ref(false);

watch(() => props.modelValue, (newVal) => {
  if (newVal !== content.value) {
    content.value = newVal;
    modified.value = false;
  }
});

function handleInput() {
  modified.value = content.value !== props.modelValue;
  emit('update:modelValue', content.value);
}

function handleFormat() {
  // 简单的格式化逻辑
  try {
    if (props.language === 'json') {
      const parsed = JSON.parse(content.value);
      content.value = JSON.stringify(parsed, null, 2);
      handleInput();
    }
  } catch (e) {
    console.error('格式化失败:', e);
  }
}

async function handleSave() {
  saving.value = true;
  try {
    await emit('save', content.value);
    modified.value = false;
  } finally {
    saving.value = false;
  }
}
</script>

<style scoped>
.code-editor {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #fff;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
}

.editor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid #dcdfe6;
  background: #f5f7fa;
}

.file-info {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: #303133;
}

.editor-actions {
  display: flex;
  gap: 8px;
}

.-container {
  flex: 1;
  overflow: hidden;
}

.editor-textarea {
  width: 100%;
  height: 100%;
  padding: 16px;
  border: none;
  outline: none;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 14px;
  line-height: 1.6;
  resize: none;
  background: #fff;
  color: #303133;
}

.editor-textarea::placeholder {
  color: #c0c4cc;
}
</style>

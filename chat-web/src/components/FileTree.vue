<!--
  文件树组件
  @author 小琳
  @date 2026-03-04
-->
<template>
  <div class="file-tree">
    <el-tree
      :data="treeData"
      :props="treeProps"
      node-key="path"
      :expand-on-click-node="false"
      :default-expanded-keys="expandedKeys"
      @node-click="handleNodeClick"
      @node-contextmenu="handleContextMenu"
    >
      <template #default="{ node, data }">
        <div class="tree-node">
          <el-icon :size="16">
            <component :is="getFileIcon(data)" />
          </el-icon>
          <span class="node-label">{{ node.label }}</span>
          <span v-if="data.size" class="node-size">{{ formatSize(data.size) }}</span>
        </div>
      </template>
    </el-tree>

    <!-- 右键菜单 -->
    <el-dropdown
      ref="contextMenuRef"
      trigger="contextmenu"
      :teleported="false"
      @command="handleCommand"
    >
      <span></span>
      <template #dropdown>
        <el-dropdown-menu>
          <el-dropdown-item command="open">打开</el-dropdown-item>
          <el-dropdown-item command="rename">重命名</el-dropdown-item>
          <el-dropdown-item command="copy">复制</el-dropdown-item>
          <el-dropdown-item command="move">移动</el-dropdown-item>
          <el-dropdown-item command="download">下载</el-dropdown-item>
          <el-dropdown-item command="delete" divided>删除</el-dropdown-item>
        </el-dropdown-menu>
      </template>
    </el-dropdown>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { Folder, Document, FolderOpened } from '@element-plus/icons-vue';

const props = defineProps({
  data: {
    type: Array,
    default: () => []
  },
  expandedKeys: {
    type: Array,
    default: () => []
  }
});

const emit = defineEmits(['node-click', 'command']);

const treeProps = {
  children: 'children',
  label: 'name',
  isLeaf: (data) => data.type === 'file'
};

const treeData = computed(() => props.data);
const contextMenuRef = ref();
const currentNode = ref(null);

function getFileIcon(data) {
  if (data.type === 'directory') {
    return data.expanded ? FolderOpened : Folder;
  }
  return Document;
}

function formatSize(bytes) {
  if (!bytes) return '';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function handleNodeClick(data, node) {
  emit('node-click', data, node);
}

function handleContextMenu(event, data, node) {
  event.preventDefault();
  currentNode.value = { data, node };
  // 显示右键菜单的逻辑
}

function handleCommand(command) {
  if (currentNode.value) {
    emit('command', command, currentNode.value.data);
  }
}
</script>

<style scoped>
.file-tree {
  height: 100%;
  overflow-y: auto;
}

.tree-node {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  padding: 4px 0;
}

.node-label {
  flex: 1;
  font-size: 14px;
  color: #303133;
}

.node-size {
  font-size: 12px;
  color: #909399;
}

:deep(.el-tree-node__content) {
  height: 32px;
}

:deep(.el-tree-node__content:hover) {
  background-color: #f5f7fa;
}
</style>

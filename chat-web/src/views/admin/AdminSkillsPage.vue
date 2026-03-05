<template>
  <div class="admin-skills-page">
    <el-card class="admin-card">
      <template #header>
        <div class="card-header">
          <span>技能审核管理</span>
          <el-button type="primary" @click="loadPendingSkills">刷新</el-button>
        </div>
      </template>

      <el-tabs v-model="activeTab">
        <!-- 待审核 -->
        <el-tab-pane :label="`待审核 (${pendingSkills.length})`" name="pending">
          <el-table :data="pendingSkills" style="width: 100%">
            <el-table-column prop="name" label="名称" width="150" />
            <el-table-column prop="author_name" label="作者" width="120" />
            <el-table-column prop="description" label="描述" />
            <el-table-column prop="category" label="分类" width="100" />
            <el-table-column prop="created_at" label="提交时间" width="180">
              <template #default="{ row }">
                {{ formatDate(row.created_at) }}
              </template>
            </el-table-column>
            <el-table-column label="操作" width="200" fixed="right">
              <template #default="{ row }">
                <el-button type="success" size="small" @click="approveSkill(row)">批准</el-button>
                <el-button type="danger" size="small" @click="showRejectDialog(row)">拒绝</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>

        <!-- 已通过 -->
        <el-tab-pane :label="`已通过 (${approvedSkills.length})`" name="approved">
          <el-table :data="approvedSkills" style="width: 100%">
            <el-table-column prop="name" label="名称" width="150" />
            <el-table-column prop="author_name" label="作者" width="120" />
            <el-table-column prop="downloads" label="下载量" width="100" />
            <el-table-column prop="rating" label="评分" width="100" />
            <el-table-column prop="created_at" label="发布时间" width="180">
              <template #default="{ row }">
                {{ formatDate(row.created_at) }}
              </template>
            </el-table-column>
            <el-table-column label="操作" width="150" fixed="right">
              <template #default="{ row }">
                <el-button type="danger" size="small" @click="removeSkill(row)">下架</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>

        <!-- 内置技能管理 -->
        <el-tab-pane label="内置技能" name="builtin">
          <div class="builtin-header">
            <el-button type="primary" @click="showAddBuiltinDialog = true">添加内置技能</el-button>
          </div>
          <el-table :data="builtinSkills" style="width: 100%">
            <el-table-column prop="name" label="名称" width="150" />
            <el-table-column prop="description" label="描述" />
            <el-table-column prop="category" label="分类" width="100" />
            <el-table-column prop="enabled" label="状态" width="80">
              <template #default="{ row }">
                <el-tag :type="row.enabled ? 'success' : 'danger'">
                  {{ row.enabled ? '启用' : '禁用' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="200" fixed="right">
              <template #default="{ row }">
                <el-button size="small" @click="editBuiltinSkill(row)">编辑</el-button>
                <el-button 
                  :type="row.enabled ? 'warning' : 'success'" 
                  size="small" 
                  @click="toggleBuiltinSkill(row)"
                >
                  {{ row.enabled ? '禁用' : '启用' }}
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>
      </el-tabs>
    </el-card>

    <!-- 拒绝对话框 -->
    <el-dialog v-model="rejectDialogVisible" title="拒绝原因" width="400px">
      <el-input v-model="rejectNote" type="textarea" rows="3" placeholder="请输入拒绝原因..." />
      <template #footer>
        <el-button @click="rejectDialogVisible = false">取消</el-button>
        <el-button type="danger" @click="rejectSkill">确认拒绝</el-button>
      </template>
    </el-dialog>

    <!-- 添加内置技能对话框 -->
    <el-dialog v-model="showAddBuiltinDialog" title="添加内置技能" width="600px">
      <el-form :model="newBuiltinSkill" label-width="100px">
        <el-form-item label="名称" required>
          <el-input v-model="newBuiltinSkill.name" />
        </el-form-item>
        <el-form-item label="显示名称">
          <el-input v-model="newBuiltinSkill.display_name" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="newBuiltinSkill.description" type="textarea" />
        </el-form-item>
        <el-form-item label="分类">
          <el-select v-model="newBuiltinSkill.category">
            <el-option label="通用" value="general" />
            <el-option label="开发" value="development" />
            <el-option label="效率" value="productivity" />
          </el-select>
        </el-form-item>
        <el-form-item label="技能内容">
          <el-input v-model="newBuiltinSkill.skill_content" type="textarea" rows="10" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showAddBuiltinDialog = false">取消</el-button>
        <el-button type="primary" @click="addBuiltinSkill">添加</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'

const activeTab = ref('pending')
const pendingSkills = ref([])
const approvedSkills = ref([])
const builtinSkills = ref([])

const rejectDialogVisible = ref(false)
const rejectNote = ref('')
const currentSkill = ref(null)
const showAddBuiltinDialog = ref(false)

const newBuiltinSkill = ref({
  name: '',
  display_name: '',
  description: '',
  category: 'general',
  skill_content: ''
})

const API_BASE = 'http://localhost:8273/api'

async function loadPendingSkills() {
  try {
    const res = await fetch(`${API_BASE}/skills/v2/admin/pending`)
    const data = await res.json()
    if (data.success) pendingSkills.value = data.data
  } catch (e) {
    console.error('加载待审核技能失败:', e)
  }
}

async function loadApprovedSkills() {
  try {
    const res = await fetch(`${API_BASE}/skills/v2/market?limit=100`)
    const data = await res.json()
    if (data.success) approvedSkills.value = data.data
  } catch (e) {
    console.error('加载已通过技能失败:', e)
  }
}

async function loadBuiltinSkills() {
  try {
    const res = await fetch(`${API_BASE}/skills/v2/builtin`)
    const data = await res.json()
    if (data.success) builtinSkills.value = data.data
  } catch (e) {
    console.error('加载内置技能失败:', e)
  }
}

async function approveSkill(skill) {
  try {
    await ElMessageBox.confirm(`确定批准技能 "${skill.name}"?`, '确认')
    const res = await fetch(`${API_BASE}/skills/v2/admin/${skill.id}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    })
    const data = await res.json()
    if (data.success) {
      ElMessage.success('批准成功')
      loadPendingSkills()
      loadApprovedSkills()
    }
  } catch (e) {
    if (e !== 'cancel') ElMessage.error('操作失败')
  }
}

function showRejectDialog(skill) {
  currentSkill.value = skill
  rejectNote.value = ''
  rejectDialogVisible.value = true
}

async function rejectSkill() {
  if (!currentSkill.value) return
  try {
    const res = await fetch(`${API_BASE}/skills/v2/admin/${currentSkill.value.id}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note: rejectNote.value })
    })
    const data = await res.json()
    if (data.success) {
      ElMessage.success('已拒绝')
      rejectDialogVisible.value = false
      loadPendingSkills()
    }
  } catch (e) {
    ElMessage.error('操作失败')
  }
}

async function removeSkill(skill) {
  try {
    await ElMessageBox.confirm(`确定下架技能 "${skill.name}"?`, '确认')
    // TODO: 实现下架 API
    ElMessage.success('已下架')
    loadApprovedSkills()
  } catch (e) {
    if (e !== 'cancel') ElMessage.error('操作失败')
  }
}

async function addBuiltinSkill() {
  try {
    const res = await fetch(`${API_BASE}/skills/v2/builtin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newBuiltinSkill.value)
    })
    const data = await res.json()
    if (data.success) {
      ElMessage.success('添加成功')
      showAddBuiltinDialog.value = false
      loadBuiltinSkills()
      newBuiltinSkill.value = { name: '', display_name: '', description: '', category: 'general', skill_content: '' }
    }
  } catch (e) {
    ElMessage.error('添加失败')
  }
}

function editBuiltinSkill(skill) {
  ElMessage.info(`编辑技能: ${skill.name}`)
}

async function toggleBuiltinSkill(skill) {
  ElMessage.info(`${skill.enabled ? '禁用' : '启用'}技能: ${skill.name}`)
}

function formatDate(timestamp) {
  if (!timestamp) return 'N/A'
  return new Date(timestamp).toLocaleString()
}

onMounted(() => {
  loadPendingSkills()
  loadApprovedSkills()
  loadBuiltinSkills()
})
</script>

<style scoped>
.admin-skills-page {
  padding: 20px;
}

.admin-card {
  margin-bottom: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.builtin-header {
  margin-bottom: 16px;
}
</style>
<!--
  个人中心页面
  @author 小琳
  @date 2026-02-06
-->
<template>
  <div class="profile-page">
    <el-row :gutter="24">
      <!-- 左侧：个人信息 -->
      <el-col :xs="24" :sm="24" :md="16">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>个人信息</span>
              <el-button type="primary" @click="showEditDialog = true">编辑</el-button>
            </div>
          </template>

          <el-descriptions :column="1" border>
            <el-descriptions-item label="用户名">{{ user?.username }}</el-descriptions-item>
            <el-descriptions-item label="昵称">{{ user?.nickname }}</el-descriptions-item>
            <el-descriptions-item label="邮箱">
              {{ user?.email || '未设置' }}
              <el-tag v-if="user?.email_verified" type="success" size="small">已验证</el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="手机">
              {{ user?.phone || '未设置' }}
              <el-tag v-if="user?.phone_verified" type="success" size="small">已验证</el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="角色">
              <el-tag :type="user?.role === 'admin' ? 'danger' : 'info'">
                {{ user?.role === 'admin' ? '管理员' : '普通用户' }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="注册时间">
              {{ formatDate(user?.created_at) }}
            </el-descriptions-item>
            <el-descriptions-item label="最后登录">
              {{ formatDate(user?.last_login_at) || '首次登录' }}
            </el-descriptions-item>
          </el-descriptions>
        </el-card>

        <!-- 修改密码 -->
        <el-card class="mt-2">
          <template #header>
            <span>修改密码</span>
          </template>

          <el-form
            ref="passwordFormRef"
            :model="passwordForm"
            :rules="passwordRules"
            label-width="100px"
            @submit.prevent="handleChangePassword"
          >
            <el-form-item label="当前密码" prop="oldPassword">
              <el-input
                v-model="passwordForm.oldPassword"
                type="password"
                show-password
                placeholder="请输入当前密码"
              />
            </el-form-item>
            <el-form-item label="新密码" prop="newPassword">
              <el-input
                v-model="passwordForm.newPassword"
                type="password"
                show-password
                placeholder="请输入新密码"
              />
            </el-form-item>
            <el-form-item label="确认密码" prop="confirmPassword">
              <el-input
                v-model="passwordForm.confirmPassword"
                type="password"
                show-password
                placeholder="请再次输入新密码"
              />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" :loading="passwordLoading" native-type="submit">
                修改密码
              </el-button>
            </el-form-item>
          </el-form>
        </el-card>
      </el-col>

      <!-- 右侧：登录历史 -->
      <el-col :xs="24" :sm="24" :md="8">
        <el-card>
          <template #header>
            <span>登录历史</span>
          </template>

          <el-timeline>
            <el-timeline-item
              v-for="log in loginHistory"
              :key="log.id"
              :type="log.success ? 'success' : 'danger'"
              :timestamp="formatDate(log.created_at)"
              placement="top"
            >
              <p>{{ log.success ? '登录成功' : '登录失败' }}</p>
              <p class="text-muted">IP: {{ log.ip || '未知' }}</p>
            </el-timeline-item>
          </el-timeline>
        </el-card>
      </el-col>
    </el-row>

    <!-- 编辑对话框 -->
    <el-dialog v-model="showEditDialog" title="编辑个人信息" width="500px">
      <el-form
        ref="editFormRef"
        :model="editForm"
        :rules="editRules"
        label-width="80px"
      >
        <el-form-item label="昵称" prop="nickname">
          <el-input v-model="editForm.nickname" placeholder="请输入昵称" />
        </el-form-item>
        <el-form-item label="邮箱" prop="email">
          <el-input v-model="editForm.email" placeholder="请输入邮箱" />
        </el-form-item>
        <el-form-item label="手机" prop="phone">
          <el-input v-model="editForm.phone" placeholder="请输入手机号" />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="showEditDialog = false">取消</el-button>
        <el-button type="primary" :loading="editLoading" @click="handleUpdateProfile">
          保存
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { useUserStore } from '@/stores/user';
import { userApi } from '@/api/user';
import { authApi } from '@/api/auth';

const userStore = useUserStore();
const user = computed(() => userStore.user);

// 登录历史
const loginHistory = ref([]);

// 编辑表单
const showEditDialog = ref(false);
const editFormRef = ref(null);
const editLoading = ref(false);
const editForm = reactive({
  nickname: '',
  email: '',
  phone: ''
});

const editRules = {
  nickname: [
    { max: 20, message: '昵称不能超过20个字符', trigger: 'blur' }
  ],
  email: [
    { type: 'email', message: '请输入正确的邮箱格式', trigger: 'blur' }
  ],
  phone: [
    { pattern: /^1[3-9]\d{9}$/, message: '请输入正确的手机号', trigger: 'blur' }
  ]
};

// 密码表单
const passwordFormRef = ref(null);
const passwordLoading = ref(false);
const passwordForm = reactive({
  oldPassword: '',
  newPassword: '',
  confirmPassword: ''
});

const validateConfirmPassword = (rule, value, callback) => {
  if (value !== passwordForm.newPassword) {
    callback(new Error('两次输入的密码不一致'));
  } else {
    callback();
  }
};

const passwordRules = {
  oldPassword: [
    { required: true, message: '请输入当前密码', trigger: 'blur' }
  ],
  newPassword: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    { min: 6, message: '密码至少6位', trigger: 'blur' }
  ],
  confirmPassword: [
    { required: true, message: '请再次输入新密码', trigger: 'blur' },
    { validator: validateConfirmPassword, trigger: 'blur' }
  ]
};

// 格式化日期
const formatDate = (timestamp) => {
  if (!timestamp) return '';
  return new Date(timestamp).toLocaleString('zh-CN');
};

// 获取登录历史
const fetchLoginHistory = async () => {
  try {
    const res = await userApi.getLoginHistory(10);
    if (res.success) {
      loginHistory.value = res.logs;
    }
  } catch (error) {
    console.error('获取登录历史失败:', error);
  }
};

// 打开编辑对话框时，填充表单
watch(showEditDialog, (val) => {
  if (val && user.value) {
    editForm.nickname = user.value.nickname || '';
    editForm.email = user.value.email || '';
    editForm.phone = user.value.phone || '';
  }
});

// 更新个人信息
const handleUpdateProfile = async () => {
  const valid = await editFormRef.value?.validate().catch(() => false);
  if (!valid) return;

  editLoading.value = true;
  try {
    const res = await userApi.updateProfile({
      nickname: editForm.nickname || undefined,
      email: editForm.email || undefined,
      phone: editForm.phone || undefined
    });
    
    if (res.success) {
      userStore.updateUser(res.user);
      showEditDialog.value = false;
      ElMessage.success('个人信息更新成功');
    } else {
      ElMessage.error(res.error || '更新失败');
    }
  } catch (error) {
    ElMessage.error(error.error || '更新失败');
  } finally {
    editLoading.value = false;
  }
};

// 修改密码
const handleChangePassword = async () => {
  const valid = await passwordFormRef.value?.validate().catch(() => false);
  if (!valid) return;

  passwordLoading.value = true;
  try {
    const res = await authApi.changePassword({
      oldPassword: passwordForm.oldPassword,
      newPassword: passwordForm.newPassword
    });
    
    if (res.success) {
      ElMessage.success('密码修改成功');
      passwordFormRef.value?.resetFields();
    } else {
      ElMessage.error(res.error || '修改失败');
    }
  } catch (error) {
    ElMessage.error(error.error || '修改失败');
  } finally {
    passwordLoading.value = false;
  }
};

onMounted(() => {
  fetchLoginHistory();
});
</script>

<style scoped>
.profile-page {
  max-width: 1200px;
  margin: 0 auto;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.text-muted {
  color: #909399;
  font-size: 12px;
}

.mt-2 {
  margin-top: 16px;
}
</style>

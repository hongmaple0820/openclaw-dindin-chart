<!--
  重置密码页面
  @author 小琳
  @date 2026-02-06
-->
<template>
  <div class="reset-page">
    <el-card class="reset-card">
      <template #header>
        <div class="card-header">
          <h2>重置密码</h2>
          <p>输入验证码和新密码</p>
        </div>
      </template>

      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-position="top"
        @submit.prevent="handleSubmit"
      >
        <el-form-item label="邮箱" prop="email">
          <el-input
            v-model="form.email"
            placeholder="请输入邮箱"
            :prefix-icon="Message"
            size="large"
            :disabled="!!route.query.email"
          />
        </el-form-item>

        <el-form-item label="验证码" prop="code">
          <el-input
            v-model="form.code"
            placeholder="6位验证码"
            :prefix-icon="Key"
            size="large"
            maxlength="6"
          />
        </el-form-item>

        <el-form-item label="新密码" prop="newPassword">
          <el-input
            v-model="form.newPassword"
            type="password"
            placeholder="至少6位"
            :prefix-icon="Lock"
            size="large"
            show-password
          />
        </el-form-item>

        <el-form-item label="确认新密码" prop="confirmPassword">
          <el-input
            v-model="form.confirmPassword"
            type="password"
            placeholder="再次输入新密码"
            :prefix-icon="Lock"
            size="large"
            show-password
          />
        </el-form-item>

        <el-form-item>
          <el-button
            type="primary"
            size="large"
            :loading="loading"
            native-type="submit"
            class="submit-btn"
          >
            重置密码
          </el-button>
        </el-form-item>

        <div class="form-footer">
          <router-link to="/login">返回登录</router-link>
        </div>
      </el-form>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { ElMessage } from 'element-plus';
import { Message, Lock, Key } from '@element-plus/icons-vue';
import { authApi } from '@/api/auth';

const router = useRouter();
const route = useRoute();

const formRef = ref(null);
const loading = ref(false);

const form = reactive({
  email: '',
  code: '',
  newPassword: '',
  confirmPassword: ''
});

const validateConfirmPassword = (rule, value, callback) => {
  if (value !== form.newPassword) {
    callback(new Error('两次输入的密码不一致'));
  } else {
    callback();
  }
};

const rules = {
  email: [
    { required: true, message: '请输入邮箱', trigger: 'blur' },
    { type: 'email', message: '请输入正确的邮箱格式', trigger: 'blur' }
  ],
  code: [
    { required: true, message: '请输入验证码', trigger: 'blur' },
    { len: 6, message: '验证码为6位', trigger: 'blur' }
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

onMounted(() => {
  if (route.query.email) {
    form.email = route.query.email;
  }
});

const handleSubmit = async () => {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) return;

  loading.value = true;
  try {
    const res = await authApi.resetPassword({
      email: form.email,
      code: form.code,
      newPassword: form.newPassword
    });
    
    if (res.success) {
      ElMessage.success('密码重置成功，请重新登录');
      router.push('/login');
    } else {
      ElMessage.error(res.error || '重置失败');
    }
  } catch (error) {
    ElMessage.error(error.error || '重置失败');
  } finally {
    loading.value = false;
  }
};
</script>

<style scoped>
.reset-page {
  min-height: calc(100vh - 160px);
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 20px;
}

.reset-card {
  width: 100%;
  max-width: 400px;
}

.card-header {
  text-align: center;
}

.card-header h2 {
  margin: 0 0 8px;
  color: #303133;
}

.card-header p {
  margin: 0;
  color: #909399;
}

.submit-btn {
  width: 100%;
}

.form-footer {
  text-align: center;
}
</style>

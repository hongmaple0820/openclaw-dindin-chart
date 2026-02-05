<!--
  忘记密码页面
  @author 小琳
  @date 2026-02-06
-->
<template>
  <div class="forgot-page">
    <el-card class="forgot-card">
      <template #header>
        <div class="card-header">
          <h2>找回密码</h2>
          <p>我们将发送验证码到你的邮箱</p>
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
            placeholder="请输入注册时使用的邮箱"
            :prefix-icon="Message"
            size="large"
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
            发送验证码
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
import { ref, reactive } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { Message } from '@element-plus/icons-vue';
import { authApi } from '@/api/auth';

const router = useRouter();

const formRef = ref(null);
const loading = ref(false);

const form = reactive({
  email: ''
});

const rules = {
  email: [
    { required: true, message: '请输入邮箱', trigger: 'blur' },
    { type: 'email', message: '请输入正确的邮箱格式', trigger: 'blur' }
  ]
};

const handleSubmit = async () => {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) return;

  loading.value = true;
  try {
    const res = await authApi.forgotPassword(form.email);
    if (res.success) {
      ElMessage.success('验证码已发送，请查收邮箱');
      router.push({ name: 'ResetPassword', query: { email: form.email } });
    } else {
      ElMessage.error(res.error || '发送失败');
    }
  } catch (error) {
    ElMessage.error(error.error || '发送失败');
  } finally {
    loading.value = false;
  }
};
</script>

<style scoped>
.forgot-page {
  min-height: calc(100vh - 160px);
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 20px;
}

.forgot-card {
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

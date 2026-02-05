<!--
  登录页面
  @author 小琳
  @date 2026-02-06
-->
<template>
  <div class="login-page">
    <el-card class="login-card">
      <template #header>
        <div class="card-header">
          <h2>登录</h2>
          <p>欢迎回来！</p>
        </div>
      </template>

      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-position="top"
        @submit.prevent="handleSubmit"
      >
        <el-form-item label="用户名/邮箱/手机" prop="username">
          <el-input
            v-model="form.username"
            placeholder="请输入用户名、邮箱或手机号"
            :prefix-icon="User"
            size="large"
          />
        </el-form-item>

        <el-form-item label="密码" prop="password">
          <el-input
            v-model="form.password"
            type="password"
            placeholder="请输入密码"
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
            登录
          </el-button>
        </el-form-item>

        <div class="form-footer">
          <router-link to="/forgot-password">忘记密码？</router-link>
          <span class="divider">|</span>
          <router-link to="/register">没有账号？立即注册</router-link>
        </div>
      </el-form>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { ElMessage } from 'element-plus';
import { User, Lock } from '@element-plus/icons-vue';
import { useUserStore } from '@/stores/user';

const router = useRouter();
const route = useRoute();
const userStore = useUserStore();

const formRef = ref(null);
const loading = ref(false);

const form = reactive({
  username: '',
  password: ''
});

const rules = {
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' }
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' }
  ]
};

const handleSubmit = async () => {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) return;

  loading.value = true;
  try {
    const res = await userStore.login(form);
    if (res.success) {
      ElMessage.success('登录成功');
      const redirect = route.query.redirect || '/';
      router.push(redirect);
    } else {
      ElMessage.error(res.error || '登录失败');
    }
  } catch (error) {
    ElMessage.error(error.error || '登录失败');
  } finally {
    loading.value = false;
  }
};
</script>

<style scoped>
.login-page {
  min-height: calc(100vh - 160px);
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 20px;
}

.login-card {
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
  color: #909399;
}

.divider {
  margin: 0 8px;
}
</style>

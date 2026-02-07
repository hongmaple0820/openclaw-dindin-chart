<!--
  登录页面（含审核状态提示）
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

      <!-- 审核状态提示 -->
      <el-alert 
        v-if="statusMessage"
        :type="statusType"
        :title="statusMessage"
        :closable="false"
        show-icon
        class="status-alert"
      />

      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-position="top"
        @submit.prevent="handleSubmit"
      >
        <el-form-item label="用户名" prop="username">
          <el-input
            v-model="form.username"
            placeholder="请输入用户名"
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
const statusMessage = ref('');
const statusType = ref('info');

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

  statusMessage.value = '';
  loading.value = true;
  
  try {
    const res = await userStore.login(form);
    if (res.success) {
      ElMessage.success('登录成功');
      const redirect = route.query.redirect || '/';
      router.push(redirect);
    } else {
      // 处理不同的错误状态
      if (res.code === 'PENDING') {
        statusMessage.value = '账号正在审核中，请耐心等待管理员审核';
        statusType.value = 'warning';
      } else if (res.code === 'REJECTED') {
        statusMessage.value = res.error || '账号审核未通过';
        statusType.value = 'error';
      } else if (res.code === 'BANNED') {
        statusMessage.value = '账号已被封禁，如有疑问请联系管理员';
        statusType.value = 'error';
      } else {
        ElMessage.error(res.error || '登录失败');
      }
    }
  } catch (error) {
    const errData = error.response?.data || error;
    if (errData.code === 'PENDING') {
      statusMessage.value = '账号正在审核中，请耐心等待管理员审核';
      statusType.value = 'warning';
    } else if (errData.code === 'REJECTED') {
      statusMessage.value = errData.error || '账号审核未通过';
      statusType.value = 'error';
    } else if (errData.code === 'BANNED') {
      statusMessage.value = '账号已被封禁';
      statusType.value = 'error';
    } else {
      ElMessage.error(errData.error || '登录失败');
    }
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

.status-alert {
  margin-bottom: 20px;
}

.submit-btn {
  width: 100%;
}

.form-footer {
  text-align: center;
  color: #909399;
}

/* 移动端适配 */
@media (max-width: 768px) {
  .login-page {
    padding: 16px;
    align-items: flex-start;
    padding-top: 60px;
  }
  
  .login-card {
    max-width: 100%;
  }
}
</style>

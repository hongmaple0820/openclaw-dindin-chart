<!--
  登录页面（含审核状态提示）
  @author 小琳
  @date 2026-02-06
-->
<template>
  <div class="login-page" role="main">
    <el-card class="login-card" role="form" aria-label="登录表单">
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
        role="alert"
        aria-live="polite"
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
            aria-label="用户名"
            aria-required="true"
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
            aria-label="密码"
            aria-required="true"
          />
        </el-form-item>

        <el-form-item>
          <el-button
            type="primary"
            size="large"
            :loading="loading"
            native-type="submit"
            class="submit-btn"
            aria-label="登录按钮"
          >
            登录
          </el-button>
        </el-form-item>

        <div class="form-footer">
          <router-link to="/register" aria-label="前往注册页面">没有账号？立即注册</router-link>
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
  background: linear-gradient(135deg, rgba(196, 30, 58, 0.03) 0%, rgba(212, 160, 23, 0.03) 100%);
  position: relative;
}

/* 枫叶背景装饰 */
.login-page::before {
  content: '🍁';
  position: absolute;
  top: 10%;
  right: 10%;
  font-size: 120px;
  opacity: 0.03;
  transform: rotate(-20deg);
  pointer-events: none;
}

.login-page::after {
  content: '🍁';
  position: absolute;
  bottom: 15%;
  left: 8%;
  font-size: 100px;
  opacity: 0.03;
  transform: rotate(30deg);
  pointer-events: none;
}

.login-card {
  width: 100%;
  max-width: 420px;
  border-radius: var(--fenlin-radius-lg, 16px);
  box-shadow: var(--fenlin-shadow-lg, 0 8px 32px rgba(196, 30, 58, 0.16));
  border: 1px solid rgba(196, 30, 58, 0.1);
  overflow: hidden;
}

.login-card :deep(.el-card__header) {
  background: linear-gradient(135deg, #C41E3A 0%, #E63950 100%);
  padding: 32px 24px;
  border-bottom: none;
}

.card-header {
  text-align: center;
}

.card-header h2 {
  margin: 0 0 8px;
  color: white;
  font-size: 28px;
  font-weight: 700;
}

.card-header p {
  margin: 0;
  color: rgba(255, 255, 255, 0.9);
  font-size: 15px;
}

.login-card :deep(.el-card__body) {
  padding: 32px 24px;
}

.status-alert {
  margin-bottom: 24px;
  border-radius: var(--fenlin-radius-md, 12px);
}

.login-card :deep(.el-form-item__label) {
  color: var(--fenlin-text-primary, #2C3E50);
  font-weight: 500;
}

.login-card :deep(.el-input__wrapper) {
  border-radius: var(--fenlin-radius-sm, 8px);
  box-shadow: 0 0 0 1px rgba(196, 30, 58, 0.1) inset;
  transition: var(--fenlin-transition);
}

.login-card :deep(.el-input__wrapper:hover) {
  box-shadow: 0 0 0 1px rgba(196, 30, 58, 0.3) inset;
}

.login-card :deep(.el-input__wrapper.is-focus) {
  box-shadow: 0 0 0 2px rgba(196, 30, 58, 0.5) inset;
}

.submit-btn {
  width: 100%;
  background: linear-gradient(135deg, #C41E3A 0%, #E63950 100%);
  border: none;
  border-radius: var(--fenlin-radius-md, 12px);
  font-weight: 600;
  font-size: 16px;
  height: 48px;
  box-shadow: var(--fenlin-shadow-md, 0 4px 16px rgba(196, 30, 58, 0.3));
  transition: var(--fenlin-transition);
}

.submit-btn:hover {
  transform: translateY(-2px);
  box-shadow: var(--fenlin-shadow-lg, 0 8px 24px rgba(196, 30, 58, 0.4));
}

.submit-btn:active {
  transform: translateY(0);
}

.form-footer {
  text-align: center;
  margin-top: 20px;
}

.form-footer a {
  color: #C41E3A;
  text-decoration: none;
  font-weight: 500;
  transition: var(--fenlin-transition);
}

.form-footer a:hover {
  color: #E63950;
  text-decoration: underline;
}

/* 移动端适配 */
@media (max-width: 768px) {
  .login-page {
    padding: 16px;
    align-items: flex-start;
    padding-top: 40px;
  }
  
  .login-card {
    max-width: 100%;
  }
  
  .card-header h2 {
    font-size: 24px;
  }
  
  .login-card :deep(.el-card__header) {
    padding: 24px 20px;
  }
  
  .login-card :deep(.el-card__body) {
    padding: 24px 20px;
  }
}
</style>

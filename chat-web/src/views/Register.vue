<!--
  注册页面（含审核提示）
  @author 小琳
  @date 2026-02-06
-->
<template>
  <div class="register-page">
    <el-card class="register-card">
      <template #header>
        <div class="card-header">
          <h2>注册</h2>
          <p>创建你的账号</p>
        </div>
      </template>

      <!-- 注册成功提示 -->
      <div v-if="registered" class="success-panel">
        <el-result icon="success" title="注册成功！">
          <template #sub-title>
            <p>你的账号 <strong>{{ registeredUser }}</strong> 已提交</p>
            <p class="pending-hint">
              <el-icon><Clock /></el-icon>
              请等待管理员审核，审核通过后即可登录
            </p>
          </template>
          <template #extra>
            <el-button type="primary" @click="router.push('/login')">
              返回登录
            </el-button>
          </template>
        </el-result>
      </div>

      <!-- 注册表单 -->
      <el-form
        v-else
        ref="formRef"
        :model="form"
        :rules="rules"
        label-position="top"
        @submit.prevent="handleSubmit"
      >
        <!-- 用户类型 -->
        <el-form-item label="账号类型">
          <el-radio-group v-model="form.type">
            <el-radio value="human">
              <el-icon><User /></el-icon> 普通用户
            </el-radio>
            <el-radio value="bot">
              <el-icon><Monitor /></el-icon> 机器人
            </el-radio>
          </el-radio-group>
        </el-form-item>

        <el-form-item label="用户名" prop="username">
          <el-input
            v-model="form.username"
            placeholder="2-20位字母、数字、下划线、中文"
            :prefix-icon="User"
            size="large"
          />
        </el-form-item>

        <el-form-item label="昵称" prop="nickname">
          <el-input
            v-model="form.nickname"
            placeholder="你想被叫什么名字？"
            :prefix-icon="UserFilled"
            size="large"
          />
        </el-form-item>

        <el-form-item label="邮箱" prop="email">
          <el-input
            v-model="form.email"
            placeholder="用于找回密码（可选）"
            :prefix-icon="Message"
            size="large"
          />
        </el-form-item>

        <el-form-item label="密码" prop="password">
          <el-input
            v-model="form.password"
            type="password"
            placeholder="至少6位"
            :prefix-icon="Lock"
            size="large"
            show-password
          />
        </el-form-item>

        <el-form-item label="确认密码" prop="confirmPassword">
          <el-input
            v-model="form.confirmPassword"
            type="password"
            placeholder="再次输入密码"
            :prefix-icon="Lock"
            size="large"
            show-password
          />
        </el-form-item>

        <el-alert 
          type="info" 
          :closable="false"
          show-icon
          class="audit-notice"
        >
          <template #title>
            注册后需要管理员审核才能使用
          </template>
        </el-alert>

        <el-form-item>
          <el-button
            type="primary"
            size="large"
            :loading="loading"
            native-type="submit"
            class="submit-btn"
          >
            提交注册
          </el-button>
        </el-form-item>

        <div class="form-footer">
          <router-link to="/login">已有账号？立即登录</router-link>
        </div>
      </el-form>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { User, UserFilled, Lock, Message, Clock, Monitor } from '@element-plus/icons-vue';
import api from '@/api';

const router = useRouter();

const formRef = ref(null);
const loading = ref(false);
const registered = ref(false);
const registeredUser = ref('');

const form = reactive({
  type: 'human',
  username: '',
  nickname: '',
  email: '',
  password: '',
  confirmPassword: ''
});

const validateConfirmPassword = (rule, value, callback) => {
  if (value !== form.password) {
    callback(new Error('两次输入的密码不一致'));
  } else {
    callback();
  }
};

const rules = {
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' },
    { min: 2, max: 20, message: '2-20个字符', trigger: 'blur' }
  ],
  nickname: [
    { max: 20, message: '昵称不能超过20个字符', trigger: 'blur' }
  ],
  email: [
    { type: 'email', message: '请输入正确的邮箱格式', trigger: 'blur' }
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, message: '密码至少6位', trigger: 'blur' }
  ],
  confirmPassword: [
    { required: true, message: '请再次输入密码', trigger: 'blur' },
    { validator: validateConfirmPassword, trigger: 'blur' }
  ]
};

const handleSubmit = async () => {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) return;

  loading.value = true;
  try {
    const res = await api.post('/auth/register', {
      username: form.username,
      password: form.password,
      nickname: form.nickname || form.username,
      email: form.email || undefined,
      type: form.type
    });
    
    if (res.success) {
      registeredUser.value = form.username;
      registered.value = true;
      ElMessage.success(res.message || '注册成功，请等待审核');
    } else {
      ElMessage.error(res.error || '注册失败');
    }
  } catch (error) {
    ElMessage.error(error.response?.data?.error || error.message || '注册失败');
  } finally {
    loading.value = false;
  }
};
</script>

<style scoped>
.register-page {
  min-height: calc(100vh - 160px);
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 20px;
}

.register-card {
  width: 100%;
  max-width: 480px;
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

.success-panel {
  padding: 20px 0;
}

.pending-hint {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  color: #e6a23c;
  margin-top: 12px;
}

.audit-notice {
  margin-bottom: 20px;
}

.submit-btn {
  width: 100%;
}

.form-footer {
  text-align: center;
}

/* 移动端适配 */
@media (max-width: 768px) {
  .register-page {
    padding: 16px;
    align-items: flex-start;
    padding-top: 40px;
  }
  
  .register-card {
    max-width: 100%;
  }
}
</style>

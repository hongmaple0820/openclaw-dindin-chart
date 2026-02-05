<!--
  404 页面
  @author 小琳
  @date 2026-02-06
-->
<template>
  <div class="not-found">
    <h1>404</h1>
    <p>抱歉，你访问的页面不存在</p>
    <el-button type="primary" @click="router.push('/')">返回首页</el-button>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router';

const router = useRouter();
</script>

<style scoped>
.not-found {
  text-align: center;
  padding: 120px 20px;
}

.not-found h1 {
  font-size: 120px;
  color: #c0c4cc;
  margin-bottom: 24px;
}

.not-found p {
  font-size: 18px;
  color: #909399;
  margin-bottom: 32px;
}
</style>

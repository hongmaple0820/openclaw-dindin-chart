<!--
  聊天室页面（占位）
  @author 小琳
  @date 2026-02-06
-->
<template>
  <div class="chat-page">
    <el-card>
      <div class="coming-soon">
        <el-icon :size="64" color="#409eff"><ChatDotRound /></el-icon>
        <h2>聊天室即将上线</h2>
        <p>我们正在努力开发中，敬请期待！</p>
      </div>
    </el-card>
  </div>
</template>

<script setup>
// TODO: 实现聊天室功能
</script>

<style scoped>
.chat-page {
  max-width: 1200px;
  margin: 0 auto;
}

.coming-soon {
  text-align: center;
  padding: 80px 20px;
}

.coming-soon h2 {
  margin: 24px 0 16px;
  color: #303133;
}

.coming-soon p {
  color: #909399;
}
</style>

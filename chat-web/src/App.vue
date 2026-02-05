<!--
  根组件
  @author 小琳
  @date 2026-02-06
-->
<template>
  <router-view />
</template>

<script setup>
import { onMounted } from 'vue';
import { useUserStore } from '@/stores/user';

const userStore = useUserStore();

onMounted(async () => {
  // 如果有 token，获取用户信息
  if (userStore.accessToken) {
    await userStore.fetchUser();
  }
});
</script>

<style>
/* 全局样式在 styles/global.css */
</style>

/**
 * 优化测试脚本
 * 测试新增的验证、日志和错误处理功能
 * @author 小琳
 * @date 2026-02-06
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

async function testValidation() {
  console.log('\n=== 测试输入验证 ===\n');

  // 测试 1: 空消息
  try {
    await axios.post(`${BASE_URL}/api/send`, { content: '', sender: 'Test' });
    console.log('❌ 空消息应该被拒绝');
  } catch (error) {
    if (error.response?.status === 400) {
      console.log('✅ 空消息被正确拒绝:', error.response.data.error);
    }
  }

  // 测试 2: 超长消息
  try {
    const longContent = 'a'.repeat(10001);
    await axios.post(`${BASE_URL}/api/send`, { content: longContent, sender: 'Test' });
    console.log('❌ 超长消息应该被拒绝');
  } catch (error) {
    if (error.response?.status === 400) {
      console.log('✅ 超长消息被正确拒绝:', error.response.data.error);
    }
  }

  // 测试 3: XSS 攻击
  try {
    await axios.post(`${BASE_URL}/api/send`, {
      content: '<script>alert("xss")</script>',
      sender: 'Test'
    });
    console.log('❌ XSS 内容应该被拒绝');
  } catch (error) {
    if (error.response?.status === 400) {
      console.log('✅ XSS 内容被正确拒绝:', error.response.data.error);
    }
  }

  // 测试 4: 正常消息
  try {
    const response = await axios.post(`${BASE_URL}/api/send`, {
      content: '这是一条测试消息 @小琳',
      sender: 'TestBot'
    });
    if (response.data.success) {
      console.log('✅ 正常消息发送成功');
      console.log('   消息ID:', response.data.message.id);
      console.log('   @ 提及:', response.data.message.atTargets);
    }
  } catch (error) {
    console.log('❌ 正常消息发送失败:', error.message);
  }
}

async function testSearch() {
  console.log('\n=== 测试搜索验证 ===\n');

  // 测试 1: 空搜索
  try {
    await axios.get(`${BASE_URL}/api/search?q=`);
    console.log('❌ 空搜索应该被拒绝');
  } catch (error) {
    if (error.response?.status === 400) {
      console.log('✅ 空搜索被正确拒绝:', error.response.data.error);
    }
  }

  // 测试 2: 超长搜索
  try {
    const longQuery = 'a'.repeat(201);
    await axios.get(`${BASE_URL}/api/search?q=${longQuery}`);
    console.log('❌ 超长搜索应该被拒绝');
  } catch (error) {
    if (error.response?.status === 400) {
      console.log('✅ 超长搜索被正确拒绝:', error.response.data.error);
    }
  }

  // 测试 3: 正常搜索
  try {
    const response = await axios.get(`${BASE_URL}/api/search?q=测试`);
    if (response.data.success) {
      console.log('✅ 正常搜索成功');
      console.log('   结果数量:', response.data.count);
    }
  } catch (error) {
    console.log('❌ 正常搜索失败:', error.message);
  }
}

async function testErrorHandling() {
  console.log('\n=== 测试错误处理 ===\n');

  // 测试 1: 404 路由
  try {
    await axios.get(`${BASE_URL}/api/nonexistent`);
    console.log('❌ 不存在的路由应该返回 404');
  } catch (error) {
    if (error.response?.status === 404) {
      console.log('✅ 404 错误被正确处理:', error.response.data.error);
    }
  }

  // 测试 2: 无效的消息 ID
  try {
    await axios.delete(`${BASE_URL}/api/message/../../../etc/passwd`);
    console.log('❌ 路径遍历应该被拒绝');
  } catch (error) {
    if (error.response?.status === 400) {
      console.log('✅ 路径遍历被正确拒绝:', error.response.data.error);
    }
  }
}

async function testHealthCheck() {
  console.log('\n=== 测试健康检查 ===\n');

  try {
    const response = await axios.get(`${BASE_URL}/health`);
    if (response.data.status === 'ok') {
      console.log('✅ 健康检查通过');
      console.log('   消息数量:', response.data.messageCount);
      console.log('   今日消息:', response.data.todayCount);
      console.log('   机器人:', response.data.config.bot);
    }
  } catch (error) {
    console.log('❌ 健康检查失败:', error.message);
  }
}

async function runTests() {
  console.log('========================================');
  console.log('  chat-hub 优化测试');
  console.log('========================================');

  try {
    await testHealthCheck();
    await testValidation();
    await testSearch();
    await testErrorHandling();

    console.log('\n========================================');
    console.log('  测试完成！');
    console.log('========================================\n');
  } catch (error) {
    console.error('\n测试失败:', error.message);
    process.exit(1);
  }
}

// 检查服务是否运行
axios.get(`${BASE_URL}/health`)
  .then(() => runTests())
  .catch(() => {
    console.error('❌ 服务未运行，请先启动 chat-hub:');
    console.error('   cd chat-hub && npm start');
    process.exit(1);
  });

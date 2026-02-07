#!/usr/bin/env node
/**
 * 钉钉通知测试脚本
 * 测试 chat-hub 的钉钉集成功能
 */

const dingtalk = require('../src/dingtalk');

async function test() {
  console.log('========================================');
  console.log('  钉钉通知测试');
  console.log('========================================\n');

  try {
    // 测试 1: 普通文本消息
    console.log('测试 1: 普通文本消息');
    await dingtalk.sendText('🧪 测试消息：chat-hub 钉钉集成正常工作！', '小琳');
    console.log('✅ 测试 1 通过\n');

    // 等待 2 秒
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 测试 2: @ 单个用户
    console.log('测试 2: @ 单个用户');
    await dingtalk.sendText('📢 这是一条 @ 消息测试', '小琳', 'maple');
    console.log('✅ 测试 2 通过\n');

    // 等待 2 秒
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 测试 3: @ 多个用户
    console.log('测试 3: @ 多个用户');
    await dingtalk.sendText('📢 多人 @ 测试', '小琳', ['maple', 'lin']);
    console.log('✅ 测试 3 通过\n');

    console.log('========================================');
    console.log('  所有测试通过！✅');
    console.log('========================================');

  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    process.exit(1);
  }
}

test();

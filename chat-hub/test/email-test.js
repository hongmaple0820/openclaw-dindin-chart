/**
 * 邮箱插件测试脚本
 * 
 * 使用方法：
 * 1. 复制 .env.example 为 .env 并填写邮箱配置
 * 2. 运行：node test/email-test.js
 */

const path = require('path');

// 加载环境变量
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { EmailChannelPlugin, initEmailChannel, getEmailChannel } = require('../src/plugins/channels/email-channel');

async function testEmail() {
  console.log('=== 邮箱插件测试 ===\n');

  // 从环境变量读取配置
  const config = {
    smtp_host: process.env.SMTP_HOST || 'smtp.qq.com',
    smtp_port: parseInt(process.env.SMTP_PORT) || 587,
    smtp_user: process.env.SMTP_USER,
    smtp_password: process.env.SMTP_PASSWORD,
    imap_host: process.env.IMAP_HOST,
    imap_port: parseInt(process.env.IMAP_PORT) || 993,
    from: process.env.EMAIL_FROM || process.env.SMTP_USER
  };

  // 检查配置
  if (!config.smtp_user || !config.smtp_password) {
    console.error('❌ 缺少邮箱配置！');
    console.log('\n请在 .env 文件中设置：');
    console.log('SMTP_HOST=smtp.qq.com');
    console.log('SMTP_PORT=587');
    console.log('SMTP_USER=your@qq.com');
    console.log('SMTP_PASSWORD=your-auth-code');
    console.log('TEST_EMAIL=recipient@example.com');
    process.exit(1);
  }

  console.log('配置信息：');
  console.log('- SMTP:', config.smtp_host + ':' + config.smtp_port);
  console.log('- 用户:', config.smtp_user);
  console.log();

  try {
    // 初始化插件
    console.log('1. 初始化插件...');
    const plugin = await initEmailChannel(config);
    console.log('✅ 初始化成功\n');

    // 测试连接
    console.log('2. 测试连接...');
    const testResult = await plugin.testConnection();
    if (testResult.success) {
      console.log('✅ 连接成功\n');
    } else {
      console.log('❌ 连接失败:', testResult.error, '\n');
      process.exit(1);
    }

    // 发送测试邮件
    const testEmail = process.env.TEST_EMAIL || config.smtp_user;
    console.log('3. 发送测试邮件到:', testEmail);
    
    const result = await plugin.sendText(
      testEmail,
      '[chat-hub] 邮箱插件测试',
      `这是一封测试邮件，发送时间：${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}\n\n来自 chat-hub 邮箱通道插件。`
    );

    if (result.success) {
      console.log('✅ 邮件发送成功！');
      console.log('- Message ID:', result.messageId);
    } else {
      console.log('❌ 发送失败');
    }

    // 测试 IMAP（如果配置了）
    if (config.imap_host) {
      console.log('\n4. 测试 IMAP（获取未读邮件）...');
      try {
        const unread = await plugin.getUnreadCount();
        console.log('✅ 未读邮件:', unread.unread, '/', unread.total);
      } catch (error) {
        console.log('⚠️ IMAP 测试失败:', error.message);
      }
    }

    // 关闭
    await plugin.close();
    console.log('\n✅ 测试完成！');

  } catch (error) {
    console.error('\n❌ 测试失败:', error.message);
    process.exit(1);
  }
}

testEmail();

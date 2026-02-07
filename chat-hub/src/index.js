const { start: startServer } = require('./server');
const OpenClawTrigger = require('./bots/openclaw-trigger');
const SmartConversationManager = require('./bots/smart-conversation');
const Analytics = require('./analytics');
const config = require('./config');
const PidLock = require('./utils/pid-lock');
const MemoryGuard = require('./utils/memory-guard');

/**
 * 主入口
 */
async function main() {
  // 获取 PID 锁
  const pidLock = new PidLock();
  
  try {
    await pidLock.acquire();
  } catch (error) {
    console.error('❌ 无法获取锁:', error.message);
    console.error('   另一个实例可能正在运行');
    console.error('   提示: 如果确认没有其他实例，请删除 ~/.openclaw/chat-hub.pid');
    process.exit(1);
  }

  // 启动内存监控
  const memoryGuard = new MemoryGuard({
    maxMemoryMB: config.memory?.maxMemoryMB || 500,
    warningThresholdPercent: config.memory?.warningThresholdPercent || 80,
    gcThresholdPercent: config.memory?.gcThresholdPercent || 90,
    checkIntervalMs: config.memory?.checkIntervalMs || 30000,
  });
  memoryGuard.start();
  const botName = config.bot?.name || 'Bot';
  const mode = config.mode || 'storage';
  const triggerEnabled = config.trigger?.enabled ?? false;
  const smartMode = config.trigger?.smart ?? false;  // 智能模式

  // 初始化使用统计
  const analytics = new Analytics(config.analytics || {});

  console.log('========================================');
  console.log(`  chat-hub 消息中转系统`);
  console.log('----------------------------------------');
  console.log(`  机器人: ${botName}`);
  console.log(`  模式: ${mode === 'hub' ? 'B - 完整中转' : 'A - 存储分析'}`);
  console.log(`  安装ID: ${analytics.installId.substring(0, 8)}...`);
  console.log('----------------------------------------');
  console.log('  功能状态:');
  console.log(`  - 消息存储: ${config.features?.storage !== false ? '✓' : '✗'}`);
  console.log(`  - 数据分析: ${config.features?.analytics !== false ? '✓' : '✗'}`);
  console.log(`  - Redis 同步: ${config.features?.redis !== false && config.redis?.enabled !== false ? '✓' : '✗'}`);
  console.log(`  - OpenClaw 触发: ${triggerEnabled ? (smartMode ? '✓ 智能模式' : '✓ 基础模式') : '✗'}`);
  console.log(`  - 钉钉 Webhook: ${config.dingtalk?.enabled !== false && config.dingtalk?.webhookBase ? '✓' : '✗'}`);
  console.log(`  - 使用统计: ${analytics.enabled ? '✓' : '✗'}`);
  console.log('========================================\n');

  // 记录启动事件
  analytics.trackStartup();
  analytics.trackDaily();

  try {
    // 1. 启动消息中转服务
    await startServer();

    // 2. 根据配置决定启动哪种触发器
    if (triggerEnabled) {
      if (smartMode) {
        // 智能对话管理器
        const manager = new SmartConversationManager(botName, {
          gatewayUrl: config.bot?.gatewayUrl || null,
          gatewayToken: config.bot?.gatewayToken || null,
          checkIntervalMs: config.trigger?.checkIntervalMs || 10000,
          botCooldownMs: config.trigger?.botCooldownMs || 30000,
          humanCooldownMs: config.trigger?.humanCooldownMs || 3000,
          maxConversationTurns: config.trigger?.maxTurns || 5
        });
        await manager.start();
        console.log('[Trigger] 智能对话管理器已启动');
      } else {
        // 基础触发器
        const trigger = new OpenClawTrigger(botName, {
          gatewayUrl: config.bot?.gatewayUrl || null,
          gatewayToken: config.bot?.gatewayToken || null,
          cooldownMs: config.trigger?.cooldownMs || 3000,
          command: config.trigger?.command || 'openclaw system event --text',
          messagePrefix: config.trigger?.messagePrefix || '[钉钉群消息]'
        });
        await trigger.start();
        console.log('[Trigger] OpenClaw 触发器已启动');
      }
      console.log('[Trigger] OpenClaw 触发器已启动');
    } else {
      console.log('[Trigger] OpenClaw 触发器未启用（模式 A：存储分析）');
    }

    console.log('\n========================================');
    console.log('  服务已启动！');
    console.log(`  API: http://localhost:${config.server?.port || 3000}`);
    if (config.redis?.host) {
      console.log(`  Redis: ${config.redis.host}:${config.redis.port || 6379}`);
    }
    console.log('========================================\n');

    // ==================== 内存监控 ====================
    const memoryMonitorInterval = setInterval(() => {
      const used = process.memoryUsage();
      const heapUsedMB = Math.round(used.heapUsed / 1024 / 1024);
      const rssMB = Math.round(used.rss / 1024 / 1024);
      
      // 内存使用超过 500MB 时告警
      if (heapUsedMB > 500) {
        console.warn(`⚠️ 内存使用过高: Heap ${heapUsedMB}MB, RSS ${rssMB}MB`);
        
        // 记录到性能日志
        if (global.gc) {
          console.log('🔄 触发垃圾回收...');
          global.gc();
        }
      }
    }, 60000); // 每分钟检查一次

    // 优雅退出
    process.on('SIGINT', async () => {
      console.log('\n正在关闭服务...');
      clearInterval(memoryMonitorInterval);
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.log('\n收到终止信号，关闭服务...');
      clearInterval(memoryMonitorInterval);
      process.exit(0);
    });

  } catch (error) {
    console.error('启动失败:', error);
    process.exit(1);
  }
}

main();

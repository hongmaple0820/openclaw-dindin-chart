const config = require('./config');

const FEATURES = {
  DINGTALK_INTEGRATION: 'dingtalkIntegration',
  WECHAT_INTEGRATION: 'wechatIntegration',
  BOT_AUTO_REPLY: 'botAutoReply',
  MESSAGE_SYNC: 'messageSync',
  BASIC_INTERACTION: 'basicInteraction'
};

const FEATURE_MESSAGES = {
  [FEATURES.DINGTALK_INTEGRATION]: {
    error: '第三方集成功能需要配置 webhook',
    hint: '请先配置钉钉 webhook'
  },
  [FEATURES.WECHAT_INTEGRATION]: {
    error: '企业微信功能需要配置 webhook',
    hint: '请先配置 webhook'
  },
  [FEATURES.BOT_AUTO_REPLY]: {
    error: '机器人自动回复需要配置 webhook',
    hint: '请先配置 webhook 以启用机器人功能'
  },
  [FEATURES.MESSAGE_SYNC]: {
    error: '消息同步功能需要配置 webhook',
    hint: '请先配置 webhook 以启用消息同步'
  }
};

function isWebhookConfigured() {
  return config.dingtalk?.enabled !== false &&
         config.dingtalk?.webhookBase &&
         config.dingtalk?.secret;
}

function isFeatureEnabled(feature) {
  if (feature === FEATURES.BASIC_INTERACTION) {
    return true;
  }

  if (!isWebhookConfigured()) {
    return false;
  }

  return true;
}

function getFeatureStatus() {
  const webhookConfigured = isWebhookConfigured();
  const dingtalkEnabled = config.dingtalk?.enabled !== false;

  return {
    webhook: {
      configured: webhookConfigured,
      enabled: dingtalkEnabled
    },
    features: {
      dingtalkIntegration: webhookConfigured,
      wechatIntegration: webhookConfigured,
      botAutoReply: webhookConfigured,
      messageSync: webhookConfigured,
      basicInteraction: true
    }
  };
}

function checkFeaturePermission(feature) {
  return (req, res, next) => {
    if (!isFeatureEnabled(feature)) {
      const featureMessage = FEATURE_MESSAGES[feature] || {
        error: '该功能需要配置 webhook 后才能使用',
        hint: '请运行 openclaw skill chat-hub-config setup 配置'
      };

      return res.status(403).json({
        success: false,
        error: 'FEATURE_DISABLED',
        message: featureMessage.error,
        hint: featureMessage.hint,
        configRequired: 'webhook',
        feature,
        webhookConfigured: isWebhookConfigured()
      });
    }
    next();
  };
}

function requireWebhook(req, res, next) {
  if (!isWebhookConfigured()) {
    return res.status(403).json({
      success: false,
      error: 'WEBHOOK_NOT_CONFIGURED',
      message: '该操作需要配置 webhook',
      hint: '请运行 openclaw skill chat-hub-config setup 配置 webhook',
      configRequired: 'webhook',
      webhookConfigured: false
    });
  }
  next();
}

function getConfigSummary() {
  return {
    webhook: {
      configured: isWebhookConfigured(),
      enabled: config.dingtalk?.enabled !== false,
      hasWebhook: !!config.dingtalk?.webhookBase,
      hasSecret: !!config.dingtalk?.secret
    },
    features: {
      dingtalkIntegration: isFeatureEnabled(FEATURES.DINGTALK_INTEGRATION),
      wechatIntegration: isFeatureEnabled(FEATURES.WECHAT_INTEGRATION),
      botAutoReply: isFeatureEnabled(FEATURES.BOT_AUTO_REPLY),
      messageSync: isFeatureEnabled(FEATURES.MESSAGE_SYNC),
      basicInteraction: true
    },
    config: {
      botName: config.bot?.name || 'Bot',
      port: config.server?.port || 3000,
      redisEnabled: config.redis?.enabled !== false
    }
  };
}

module.exports = {
  FEATURES,
  isWebhookConfigured,
  isFeatureEnabled,
  getFeatureStatus,
  checkFeaturePermission,
  requireWebhook,
  getConfigSummary
};

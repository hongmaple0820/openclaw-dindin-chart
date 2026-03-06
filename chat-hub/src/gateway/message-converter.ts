/**
 * 消息格式转换工具
 * 
 * 提供不同平台间消息格式的转换能力
 * 
 * @author 小琳
 * @date 2026-03-06
 */

import { UnifiedMessage, Platform, MessageType } from './index';

/** 转换选项 */
export interface ConversionOptions {
  /** 目标平台 */
  targetPlatform: Platform;
  /** 是否保留原始格式标记 */
  preserveFormatting?: boolean;
  /** 是否自动截断超长内容 */
  autoTruncate?: boolean;
  /** 最大内容长度 */
  maxContentLength?: number;
}

/** 平台特性配置 */
export interface PlatformFeatures {
  /** 支持 Markdown */
  supportsMarkdown: boolean;
  /** 支持 @ 提及 */
  supportsMention: boolean;
  /** 支持富文本 */
  supportsRichText: boolean;
  /** 支持交互式卡片 */
  supportsInteractiveCard: boolean;
  /** 最大文本长度 */
  maxTextLength: number;
  /** 最大标题长度 */
  maxTitleLength: number;
  /** @ 提及格式 */
  mentionFormat: (id: string) => string;
}

/** 各平台特性配置 */
export const PLATFORM_FEATURES: Record<Platform, PlatformFeatures> = {
  dingtalk: {
    supportsMarkdown: true,
    supportsMention: true,
    supportsRichText: false,
    supportsInteractiveCard: true,
    maxTextLength: 20000,
    maxTitleLength: 64,
    mentionFormat: (id: string) => `@${id}`
  },
  wecom: {
    supportsMarkdown: true,
    supportsMention: true,
    supportsRichText: false,
    supportsInteractiveCard: true,
    maxTextLength: 4096,
    maxTitleLength: 64,
    mentionFormat: (id: string) => `<@${id}>`
  },
  feishu: {
    supportsMarkdown: false, // 飞书使用富文本
    supportsMention: true,
    supportsRichText: true,
    supportsInteractiveCard: true,
    maxTextLength: 30000,
    maxTitleLength: 100,
    mentionFormat: (id: string) => `<at user_id="${id}"></at>`
  },
  slack: {
    supportsMarkdown: false, // Slack 使用 mrkdwn
    supportsMention: true,
    supportsRichText: true,
    supportsInteractiveCard: true,
    maxTextLength: 40000,
    maxTitleLength: 150,
    mentionFormat: (id: string) => `<@${id}>`
  },
  discord: {
    supportsMarkdown: true,
    supportsMention: true,
    supportsRichText: true,
    supportsInteractiveCard: true,
    maxTextLength: 2000,
    maxTitleLength: 256,
    mentionFormat: (id: string) => `<@${id}>`
  },
  webchat: {
    supportsMarkdown: true,
    supportsMention: false,
    supportsRichText: true,
    supportsInteractiveCard: true,
    maxTextLength: 100000,
    maxTitleLength: 500,
    mentionFormat: (id: string) => `@${id}`
  }
};

/**
 * 消息格式转换器
 */
export class MessageConverter {
  /**
   * 转换消息格式
   */
  static convert(message: UnifiedMessage, options: ConversionOptions): UnifiedMessage {
    const features = PLATFORM_FEATURES[options.targetPlatform];
    let content = message.content;

    // 处理平台不支持 Markdown 的情况
    if (!features.supportsMarkdown && message.type === 'markdown') {
      content = this.markdownToText(message.content);
    }

    // 处理 @ 提及格式转换
    content = this.convertMentions(content, message.platform, options.targetPlatform);

    // 自动截断超长内容
    if (options.autoTruncate && content.length > (options.maxContentLength || features.maxTextLength)) {
      content = content.slice(0, options.maxContentLength || features.maxTextLength) + '...';
    }

    return {
      ...message,
      platform: options.targetPlatform,
      content,
      type: this.convertMessageType(message.type, options.targetPlatform),
      metadata: {
        ...message.metadata,
        originalPlatform: message.platform,
        converted: true
      }
    };
  }

  /**
   * 转换消息类型
   */
  private static convertMessageType(type: MessageType, targetPlatform: Platform): MessageType {
    const features = PLATFORM_FEATURES[targetPlatform];

    // 平台不支持 markdown，转为 text
    if (type === 'markdown' && !features.supportsMarkdown) {
      return 'text';
    }

    return type;
  }

  /**
   * Markdown 转纯文本
   */
  private static markdownToText(markdown: string): string {
    return markdown
      // 移除标题标记
      .replace(/^#{1,6}\s+/gm, '')
      // 移除粗体/斜体
      .replace(/[*_]{1,3}([^*_]+)[*_]{1,3}/g, '$1')
      // 移除删除线
      .replace(/~~([^~]+)~~/g, '$1')
      // 转换链接
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)')
      // 移除代码块
      .replace(/```[\s\S]*?```/g, (match) => match.replace(/```\w*\n?/g, '').trim())
      // 移除行内代码
      .replace(/`([^`]+)`/g, '$1')
      // 移除图片
      .replace(/!\[([^\]]*)\]\([^)]+\)/g, '[图片]')
      // 移除引用
      .replace(/^>\s+/gm, '')
      // 移除水平线
      .replace(/^[-*_]{3,}$/gm, '')
      // 清理多余空行
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  /**
   * 转换 @ 提及格式
   */
  private static convertMentions(
    content: string,
    sourcePlatform: Platform,
    targetPlatform: Platform
  ): string {
    const sourceFeatures = PLATFORM_FEATURES[sourcePlatform];
    const targetFeatures = PLATFORM_FEATURES[targetPlatform];

    // 如果目标平台不支持 @，直接移除
    if (!targetFeatures.supportsMention) {
      // 移除各平台的 @ 格式
      return content
        .replace(/@\d{11}/g, '') // 钉钉手机号
        .replace(/<@[^>]+>/g, '') // 企业微信/Slack/Discord
        .replace(/<at user_id="[^"]+"><\/at>/g, ''); // 飞书
    }

    // 钉钉格式: @手机号
    if (sourcePlatform === 'dingtalk') {
      const mobilePattern = /@(\d{11})/g;
      if (targetPlatform === 'wecom') {
        return content.replace(mobilePattern, '<@$1>');
      }
      if (targetPlatform === 'feishu') {
        return content.replace(mobilePattern, '<at user_id="$1"></at>');
      }
    }

    // 企业微信格式: <@user_id>
    if (sourcePlatform === 'wecom') {
      const wecomPattern = /<@([^>]+)>/g;
      if (targetPlatform === 'dingtalk') {
        return content.replace(wecomPattern, '@$1');
      }
      if (targetPlatform === 'feishu') {
        return content.replace(wecomPattern, '<at user_id="$1"></at>');
      }
    }

    // 飞书格式: <at user_id="xxx"></at>
    if (sourcePlatform === 'feishu') {
      const feishuPattern = /<at user_id="([^"]+)"><\/at>/g;
      if (targetPlatform === 'dingtalk') {
        return content.replace(feishuPattern, '@$1');
      }
      if (targetPlatform === 'wecom') {
        return content.replace(feishuPattern, '<@$1>');
      }
    }

    return content;
  }

  /**
   * 获取平台特性
   */
  static getPlatformFeatures(platform: Platform): PlatformFeatures {
    return PLATFORM_FEATURES[platform];
  }

  /**
   * 检查消息是否需要转换
   */
  static needsConversion(message: UnifiedMessage, targetPlatform: Platform): boolean {
    return message.platform !== targetPlatform;
  }

  /**
   * 验证消息格式
   */
  static validateMessage(message: UnifiedMessage, platform: Platform): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];
    const features = PLATFORM_FEATURES[platform];

    if (!message.content || message.content.trim().length === 0) {
      errors.push('消息内容不能为空');
    }

    if (message.content.length > features.maxTextLength) {
      errors.push(`消息内容超过最大长度 ${features.maxTextLength}`);
    }

    if (message.type === 'markdown' && !features.supportsMarkdown) {
      errors.push('目标平台不支持 Markdown 格式');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

/**
 * 快捷转换函数
 */
export function convertMessage(
  message: UnifiedMessage,
  targetPlatform: Platform,
  options?: Partial<ConversionOptions>
): UnifiedMessage {
  return MessageConverter.convert(message, {
    targetPlatform,
    preserveFormatting: true,
    autoTruncate: true,
    ...options
  });
}

/**
 * 批量转换消息
 */
export function convertMessages(
  messages: UnifiedMessage[],
  targetPlatform: Platform,
  options?: Partial<ConversionOptions>
): UnifiedMessage[] {
  return messages.map(msg => convertMessage(msg, targetPlatform, options));
}

export default MessageConverter;
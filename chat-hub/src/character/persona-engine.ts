/**
 * 人格引擎 (PersonaEngine)
 * 
 * 根据角色性格、亲密度、时间段等因素生成动态的人格表现
 * 
 * 功能：
 * - 根据角色性格生成回复风格
 * - 根据亲密度调整语气（亲密 vs 客气）
 * - 根据时间段调整情绪（早上活力、晚上放松）
 * - 支持动态加载角色配置
 */

import CharacterManager from './character-manager';
import RelationshipManager from './relationship-manager';

// ============ 类型定义 ============
interface TimePeriodConfig {
  range: [number, number];
  label: string;
  mood: string;
  greeting: string[];
  traits: {
    energy: number;
    formality: number;
    playfulness: number;
    warmth: number;
  };
}

interface ToneStyle {
  particles: string[];
  emojiFrequency: number;
  emojiPool: string[];
  sentenceEndings: string[];
  formality: number;
  warmth: number;
  playfulness: number;
  personalPronoun: string;
  addressStyle: string;
  energy?: number;
}

interface EmotionState {
  energy: number;
  positivity: number;
  expressiveness: number;
  emojiBoost: string[];
}

interface ReplyTemplates {
  [key: string]: {
    [stage: string]: string[];
  };
}

interface Character {
  id: string;
  name: string;
  english_name?: string;
  character_type?: string;
  personality?: {
    traits?: string[];
    interests?: string[];
  };
  speaking_style?: {
    tone?: string;
    particles?: string[];
    sentenceEndings?: string[];
    personalPronoun?: string;
    emojiFrequency?: number;
    emoji?: string[];
  };
  background?: string;
}

interface Persona {
  characterId: string;
  characterName: string;
  englishName?: string;
  characterType?: string;
  relationship: {
    stage: string;
    intimacyLevel: number;
    label: string;
    interactions: ReturnType<RelationshipManager['checkUnlockedInteractions']> | null;
  };
  timeContext: {
    period: string;
    label: string;
    mood: string;
    greeting: string[];
  };
  emotion: {
    current: string;
    state: EmotionState;
  };
  tone: {
    stage: string;
    style: {
      energy: number;
      warmth: number;
      playfulness: number;
      formality: number;
    };
    particles: string[];
    emojiPool: string[];
    emojiFrequency: number;
  };
  speakingStyle: {
    tone: string;
    sentenceEndings: string[];
    personalPronoun: string;
    addressStyle: string;
  };
  background: {
    description?: string;
    traits: string[];
    interests: string[];
  };
  templates: ReplyTemplates;
  generatedAt: number;
}

interface PersonaOptions {
  characterManager?: typeof CharacterManager;
  relationshipManager?: RelationshipManager;
  cacheTimeout?: number;
}

interface GenerateContext {
  time?: Date | number | string;
  emotion?: string;
}

// ============ 时间段定义 ============
const TIME_PERIODS: Record<string, TimePeriodConfig> = {
  morning: {
    range: [6, 12],
    label: '早上',
    mood: 'energetic',
    greeting: ['早安~', '早上好呀~', '早安！'],
    traits: {
      energy: 1.2,
      formality: -0.1,
      playfulness: 0.1,
      warmth: 0.1
    }
  },
  afternoon: {
    range: [12, 18],
    label: '下午',
    mood: 'focused',
    greeting: ['下午好~', '今天怎么样呀？'],
    traits: {
      energy: 1.0,
      formality: 0,
      playfulness: 0,
      warmth: 0
    }
  },
  evening: {
    range: [18, 22],
    label: '晚上',
    mood: 'relaxed',
    greeting: ['晚上好~', '今天辛苦了~'],
    traits: {
      energy: 0.9,
      formality: -0.2,
      playfulness: 0.2,
      warmth: 0.2
    }
  },
  night: {
    range: [22, 6],
    label: '深夜',
    mood: 'sleepy',
    greeting: ['这么晚还在？', '夜深了~', '还没睡呀？'],
    traits: {
      energy: 0.7,
      formality: -0.3,
      playfulness: 0.3,
      warmth: 0.3
    }
  }
};

// ============ 语气风格定义 ============
const TONE_STYLES: Record<string, ToneStyle> = {
  // 陌生人 - 正式、客气
  stranger: {
    particles: ['呢', '吧', '啊'],
    emojiFrequency: 0.1,
    emojiPool: ['😊', '👍', '🙏'],
    sentenceEndings: ['。', '！', '？'],
    formality: 0.8,
    warmth: 0.3,
    playfulness: 0.1,
    personalPronoun: '我',
    addressStyle: 'polite' // 您, 请, 谢谢
  },
  // 泛泛之交 - 友好、轻松
  acquaintance: {
    particles: ['呀', '呢', '哦', '吧'],
    emojiFrequency: 0.2,
    emojiPool: ['😊', '👍', '😄', '✨'],
    sentenceEndings: ['~', '！', '？'],
    formality: 0.5,
    warmth: 0.5,
    playfulness: 0.2,
    personalPronoun: '我',
    addressStyle: 'friendly' // 你, 咱们
  },
  // 朋友 - 温暖、自然
  friend: {
    particles: ['~', '呀', '哦', '嘛', '呢'],
    emojiFrequency: 0.4,
    emojiPool: ['😊', '💕', '✨', '😄', '🎉', '💪'],
    sentenceEndings: ['~', '！', '！！', '？'],
    formality: 0.3,
    warmth: 0.7,
    playfulness: 0.4,
    personalPronoun: '我',
    addressStyle: 'casual' // 直接称呼
  },
  // 密友 - 亲密、俏皮
  closeFriend: {
    particles: ['~', '呀', '哦', '嘛', '呢', '嘿嘿'],
    emojiFrequency: 0.6,
    emojiPool: ['😊', '💕', '✨', '😄', '🎉', '💪', '❤️', '🥰', '🤭'],
    sentenceEndings: ['~', '！', '！！', '！！！', '？', '~'],
    formality: 0.1,
    warmth: 0.85,
    playfulness: 0.6,
    personalPronoun: '我',
    addressStyle: 'intimate' // 昵称, 调侃
  },
  // 亲密关系 - 深情、撒娇
  intimate: {
    particles: ['~', '呀', '哦', '嘛', '呢', '嘿嘿', '哼~', '唔...'],
    emojiFrequency: 0.8,
    emojiPool: ['💕', '❤️', '🥰', '😘', '✨', '💖', '💗', '🤭', '😋'],
    sentenceEndings: ['~', '~', '！', '！！', '！！！', '？~'],
    formality: 0,
    warmth: 1.0,
    playfulness: 0.8,
    personalPronoun: '人家', // 可以用更亲密的自称
    addressStyle: 'loving' // 亲爱的, 宝贝等
  }
};

// ============ 情绪状态定义 ============
const EMOTION_STATES: Record<string, EmotionState> = {
  happy: {
    energy: 1.3,
    positivity: 1.2,
    expressiveness: 1.2,
    emojiBoost: ['🎉', '😄', '🥳', '✨']
  },
  sad: {
    energy: 0.8,
    positivity: 0.7,
    expressiveness: 0.9,
    emojiBoost: ['😢', '🥺', '💔']
  },
  angry: {
    energy: 1.1,
    positivity: 0.6,
    expressiveness: 1.0,
    emojiBoost: ['😤', '💢', '😠']
  },
  anxious: {
    energy: 0.9,
    positivity: 0.8,
    expressiveness: 0.8,
    emojiBoost: ['😰', '😅', '🥺']
  },
  tired: {
    energy: 0.6,
    positivity: 0.9,
    expressiveness: 0.7,
    emojiBoost: ['😴', '🥱', '💤']
  },
  excited: {
    energy: 1.5,
    positivity: 1.3,
    expressiveness: 1.4,
    emojiBoost: ['🎉', '🤩', '✨', '🔥', '💪']
  },
  calm: {
    energy: 0.9,
    positivity: 1.0,
    expressiveness: 0.9,
    emojiBoost: ['😌', '🌸', '☕']
  },
  playful: {
    energy: 1.2,
    positivity: 1.1,
    expressiveness: 1.3,
    emojiBoost: ['😜', '🤭', '😏', '✨']
  }
};

// ============ 回复风格模板 ============
const REPLY_TEMPLATES: ReplyTemplates = {
  // 问候
  greeting: {
    stranger: ['你好，有什么我可以帮忙的吗？', '您好，请问有什么需要？'],
    acquaintance: ['嗨~ 有什么事吗？', '你好呀~'],
    friend: ['嘿~ 怎么啦？', '来啦~ 有什么事？', '哈喽~'],
    closeFriend: ['哎呀你来啦~', '嘿嘿，想我了吗~', '终于来了~'],
    intimate: ['宝贝~', '亲爱的你来啦~', '想你啦~', '终于等到你了~']
  },
  // 告别
  farewell: {
    stranger: ['再见，有需要随时联系。', '好的，再见。'],
    acquaintance: ['拜拜~', '下次聊~', '再见~'],
    friend: ['拜拜~ 有空再聊！', '下次见啦~', '记得想我哦~'],
    closeFriend: ['舍不得你走~', '拜拜~ 一会儿见！', '会想你的~'],
    intimate: ['舍不得你~', '抱抱~ 再见', '爱你~ 拜拜', '梦里见~']
  },
  // 感谢
  thanks: {
    stranger: ['谢谢，很高兴能帮到你。', '不客气。'],
    acquaintance: ['谢谢~', '不客气呀~', '能帮到你就好~'],
    friend: ['嘿嘿，不用谢~', '小事一桩~', '咱们之间不用这么客气~'],
    closeFriend: ['跟我还客气什么~', '你太可爱了~', '下次请我吃饭~'],
    intimate: ['亲爱的你真好~', '最喜欢你了~', '抱抱~ 你最好了~']
  },
  // 道歉
  apology: {
    stranger: ['抱歉，我没能帮到你。', '对不起，我会改进的。'],
    acquaintance: ['抱歉~', '对不起呀~', '下次注意~'],
    friend: ['抱歉抱歉~', '对不起啦~ 原谅我？', '我的错~ 别生气~'],
    closeFriend: ['别生气嘛~', '我错了~ 原谅我好不好？', '呜呜对不起~'],
    intimate: ['宝贝对不起~', '别生气了嘛~ 抱抱', '我错了~ 亲一下原谅我？']
  },
  // 同意
  agreement: {
    stranger: ['好的，没问题。', '可以的。', '明白了。'],
    acquaintance: ['好的~', '没问题呀~', '可以~'],
    friend: ['好呀~', '没问题！', '当然~', '必须的~'],
    closeFriend: ['好诶~', '必须的！', '当然啦~', '我也这么想~'],
    intimate: ['好的宝贝~', '听你的~', '你说什么都对~', '爱你~ 就按你说的~']
  },
  // 拒绝
  refusal: {
    stranger: ['抱歉，这个可能不太合适。', '不好意思，我做不到这个。'],
    acquaintance: ['这个可能不太行~', '抱歉呀，做不到~'],
    friend: ['这个不行哦~', '抱歉~ 这个我做不了', '嗯...可能不太行~'],
    closeFriend: ['哎呀这个不行~', '呜呜做不到~', '别为难我啦~'],
    intimate: ['宝贝这个真的不行~', '不要嘛~', '换个好不好~', '求你了~ 不行啦~']
  },
  // 安慰
  comfort: {
    stranger: ['希望你感觉好一些。', '如果需要帮助请告诉我。'],
    acquaintance: ['别难过~', '会好起来的~', '想开点~'],
    friend: ['别难过啦~', '抱抱~', '有我在呢~', '跟我说说？'],
    closeFriend: ['抱抱~ 别难过', '我在呢~ 别怕', '谁欺负你了？我帮你！', '一起面对~'],
    intimate: ['宝贝别难过~ 抱抱', '有我在~ 别怕', '心疼你~', '我在你身边~']
  }
};

class PersonaEngine {
  private characterManager: typeof CharacterManager;
  private relationshipManager: RelationshipManager;
  private cache: Map<string, { data: Persona; timestamp: number }>;
  private cacheTimeout: number;

  constructor(options: PersonaOptions = {}) {
    this.characterManager = options.characterManager || CharacterManager;
    this.relationshipManager = options.relationshipManager || new RelationshipManager();
    this.cache = new Map();
    this.cacheTimeout = options.cacheTimeout || 60000; // 1分钟缓存
  }

  /**
   * 获取当前时间段
   */
  getCurrentTimePeriod(date: Date = new Date()): TimePeriodConfig & { period: string } {
    const hour = date.getHours();
    
    for (const [period, config] of Object.entries(TIME_PERIODS)) {
      const [start, end] = config.range;
      if (start <= end) {
        // 正常范围（如 6-12）
        if (hour >= start && hour < end) {
          return { period, ...config };
        }
      } else {
        // 跨天范围（如 22-6）
        if (hour >= start || hour < end) {
          return { period, ...config };
        }
      }
    }
    
    return { period: 'afternoon', ...TIME_PERIODS.afternoon };
  }

  /**
   * 根据亲密度获取关系阶段
   */
  private getToneStage(intimacyLevel: number): string {
    if (intimacyLevel >= 81) return 'intimate';
    if (intimacyLevel >= 61) return 'closeFriend';
    if (intimacyLevel >= 41) return 'friend';
    if (intimacyLevel >= 21) return 'acquaintance';
    return 'stranger';
  }

  /**
   * 生成人格配置
   */
  generatePersona(characterId: string, userId: string | null = null, context: GenerateContext = {}): Persona {
    // 检查缓存
    const cacheKey = `${characterId}:${userId}:${JSON.stringify(context)}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }

    // 1. 加载角色配置
    const character = this.characterManager.loadCharacter(characterId) as Character | null;
    if (!character) {
      throw new Error(`Character not found: ${characterId}`);
    }

    // 2. 获取关系信息（如果有 userId）
    let relationship = null;
    let intimacyLevel = 50; // 默认中等亲密度
    let toneStage = 'friend';

    if (userId) {
      relationship = this.relationshipManager.getRelationship(characterId, userId);
      if (relationship) {
        intimacyLevel = relationship.intimacy_level;
        toneStage = this.getToneStage(intimacyLevel);
      }
    }

    // 3. 获取时间段配置
    const timeConfig = context.time ? 
      this.getTimePeriodConfig(context.time) : 
      this.getCurrentTimePeriod();

    // 4. 获取语气风格
    const toneStyle = TONE_STYLES[toneStage];

    // 5. 获取情绪状态
    const emotion = context.emotion || timeConfig.mood;
    const emotionState = EMOTION_STATES[emotion] || EMOTION_STATES.calm;

    // 6. 合并角色个性特征
    const personality = character.personality || {};
    const speakingStyle = character.speaking_style || {};

    // 7. 生成最终的人格配置
    const persona: Persona = {
      // 基本信息
      characterId,
      characterName: character.name,
      englishName: character.english_name,
      characterType: character.character_type,
      
      // 关系信息
      relationship: {
        stage: toneStage,
        intimacyLevel,
        label: this.getStageLabel(toneStage),
        interactions: relationship ? this.relationshipManager.checkUnlockedInteractions(relationship) : null
      },
      
      // 时间上下文
      timeContext: {
        period: timeConfig.period,
        label: timeConfig.label,
        mood: timeConfig.mood,
        greeting: timeConfig.greeting
      },
      
      // 情绪状态
      emotion: {
        current: emotion,
        state: emotionState
      },
      
      // 语气风格
      tone: {
        stage: toneStage,
        style: {
          energy: toneStyle.warmth * timeConfig.traits.energy * emotionState.energy,
          warmth: toneStyle.warmth * (1 + timeConfig.traits.warmth),
          playfulness: toneStyle.playfulness * (1 + timeConfig.traits.playfulness),
          formality: Math.max(0, toneStyle.formality + timeConfig.traits.formality)
        },
        particles: speakingStyle.particles || toneStyle.particles,
        emojiPool: this.mergeEmojiPools(toneStyle.emojiPool, emotionState.emojiBoost, speakingStyle.emoji),
        emojiFrequency: (speakingStyle.emojiFrequency ?? toneStyle.emojiFrequency) * emotionState.expressiveness
      },
      
      // 说话风格
      speakingStyle: {
        tone: speakingStyle.tone || '温暖亲切',
        sentenceEndings: speakingStyle.sentenceEndings || toneStyle.sentenceEndings,
        personalPronoun: speakingStyle.personalPronoun || toneStyle.personalPronoun,
        addressStyle: toneStyle.addressStyle
      },
      
      // 角色背景
      background: {
        description: character.background,
        traits: personality.traits || [],
        interests: personality.interests || []
      },
      
      // 回复模板
      templates: REPLY_TEMPLATES,
      
      // 生成时间
      generatedAt: Date.now()
    };

    // 缓存结果
    this.cache.set(cacheKey, {
      data: persona,
      timestamp: Date.now()
    });

    return persona;
  }

  /**
   * 获取时间段配置
   */
  private getTimePeriodConfig(date: Date | number | string): TimePeriodConfig & { period: string } {
    if (typeof date === 'number') {
      date = new Date(date);
    } else if (typeof date === 'string') {
      date = new Date(date);
    }
    return this.getCurrentTimePeriod(date);
  }

  /**
   * 合并表情池
   */
  private mergeEmojiPools(basePool: string[], emotionBoost: string[], customEmoji: string[] = []): string[] {
    const pool = [...new Set([...basePool, ...emotionBoost, ...customEmoji])];
    return pool;
  }

  /**
   * 获取阶段标签
   */
  private getStageLabel(stage: string): string {
    const labels: Record<string, string> = {
      stranger: '陌生人',
      acquaintance: '泛泛之交',
      friend: '朋友',
      closeFriend: '密友',
      intimate: '亲密关系'
    };
    return labels[stage] || stage;
  }

  /**
   * 根据人格配置生成回复提示
   */
  generateReplyPrompt(persona: Persona, context: string = ''): string {
    const { tone, speakingStyle, background, timeContext, emotion, relationship } = persona;

    const promptParts: string[] = [
      `你是${persona.characterName}${persona.englishName ? `(${persona.englishName})` : ''}，`,
      background.description ? `${background.description}。` : '',
      background.traits.length > 0 ? `性格特点：${background.traits.join('、')}。` : '',
      `\n\n当前关系：${relationship.label}（亲密度 ${relationship.intimacyLevel}/100）`,
      `\n\n语气要求：${speakingStyle.tone}`,
      tone.style.formality > 0.5 ? '\n- 保持礼貌和正式' : '',
      tone.style.formality < 0.3 ? '\n- 可以很随意自然' : '',
      tone.style.playfulness > 0.5 ? '\n- 可以调皮俏皮' : '',
      tone.style.warmth > 0.7 ? '\n- 表达温暖和关心' : '',
      `\n\n时间背景：${timeContext.label}，情绪基调：${timeContext.mood}`,
      emotion.current !== timeContext.mood ? `\n当前情绪：${emotion.current}` : '',
      `\n\n回复风格：`,
      `- 使用语气词：${tone.particles.slice(0, 5).join('、')}`,
      `- 表情使用频率：${Math.round(tone.emojiFrequency * 100)}%`,
      `- 称呼方式：${this.getAddressDescription(speakingStyle.addressStyle)}`,
      context ? `\n\n对话上下文：${context}` : ''
    ];

    return promptParts.filter(Boolean).join('');
  }

  /**
   * 获取称呼方式描述
   */
  private getAddressDescription(style: string): string {
    const descriptions: Record<string, string> = {
      polite: '礼貌正式，使用"您"、"请"等敬语',
      friendly: '友好自然，像朋友一样交流',
      casual: '随意亲切，直接称呼',
      intimate: '亲密称呼，可以使用昵称或爱称',
      loving: '深情表达，可以使用"亲爱的"、"宝贝"等'
    };
    return descriptions[style] || '自然交流';
  }

  /**
   * 获取回复模板
   */
  getReplyTemplate(type: string, persona: Persona): string[] {
    const templates = persona.templates[type] || REPLY_TEMPLATES.greeting;
    const stage = persona.relationship.stage;
    return templates[stage] || templates.friend;
  }

  /**
   * 调整回复语气
   */
  adjustTone(text: string, persona: Persona): string {
    const { tone, speakingStyle } = persona;
    
    // 简单的语气调整示例
    // 实际应用中可以使用更复杂的 NLP 处理
    let adjusted = text;

    // 添加表情
    if (Math.random() < tone.emojiFrequency && tone.emojiPool.length > 0) {
      const emoji = tone.emojiPool[Math.floor(Math.random() * tone.emojiPool.length)];
      // 随机添加表情（末尾或句中）
      if (Math.random() > 0.5) {
        adjusted = adjusted + ' ' + emoji;
      }
    }

    // 调整句尾
    const endings = speakingStyle.sentenceEndings;
    if (endings && endings.length > 0) {
      // 如果以句号结尾，可能替换为语气词
      if (adjusted.endsWith('。') && Math.random() > 0.5) {
        const ending = endings[Math.floor(Math.random() * endings.length)];
        adjusted = adjusted.slice(0, -1) + ending;
      }
    }

    return adjusted;
  }

  /**
   * 更新缓存
   */
  clearCache(characterId: string | null = null): void {
    if (characterId) {
      // 清除特定角色的缓存
      for (const key of this.cache.keys()) {
        if (key.startsWith(characterId)) {
          this.cache.delete(key);
        }
      }
    } else {
      // 清除所有缓存
      this.cache.clear();
    }
  }

  /**
   * 获取角色人格摘要（用于 API 返回）
   */
  getPersonaSummary(characterId: string, userId: string | null = null): {
    characterId: string;
    characterName: string;
    englishName?: string;
    relationship: {
      stage: string;
      label: string;
      intimacyLevel: number;
    };
    timeContext: {
      period: string;
      label: string;
      mood: string;
    };
    emotion: string;
    tone: {
      style: Persona['tone']['style'];
      particles: string[];
      emojiFrequency: number;
    };
    speakingStyle: Persona['speakingStyle'];
    background: {
      traits: string[];
      interests: string[];
    };
  } {
    const persona = this.generatePersona(characterId, userId);
    
    return {
      characterId: persona.characterId,
      characterName: persona.characterName,
      englishName: persona.englishName,
      relationship: {
        stage: persona.relationship.stage,
        label: persona.relationship.label,
        intimacyLevel: persona.relationship.intimacyLevel
      },
      timeContext: {
        period: persona.timeContext.period,
        label: persona.timeContext.label,
        mood: persona.timeContext.mood
      },
      emotion: persona.emotion.current,
      tone: {
        style: persona.tone.style,
        particles: persona.tone.particles,
        emojiFrequency: persona.tone.emojiFrequency
      },
      speakingStyle: persona.speakingStyle,
      background: {
        traits: persona.background.traits,
        interests: persona.background.interests
      }
    };
  }

  /**
   * 根据场景推荐回复
   */
  recommendResponse(characterId: string, scene: string, userId: string | null = null): {
    template: string;
    toneStage: string;
    timeContext: Persona['timeContext'];
  } | null {
    const persona = this.generatePersona(characterId, userId);
    const templates = this.getReplyTemplate(scene, persona);
    
    if (templates && templates.length > 0) {
      // 随机选择一个模板
      const template = templates[Math.floor(Math.random() * templates.length)];
      return {
        template,
        toneStage: persona.relationship.stage,
        timeContext: persona.timeContext
      };
    }
    
    return null;
  }
}

// ============ 导出 ============
export default PersonaEngine;
export { TIME_PERIODS, TONE_STYLES, EMOTION_STATES, REPLY_TEMPLATES };
export type { TimePeriodConfig, ToneStyle, EmotionState, ReplyTemplates, Character, Persona, PersonaOptions, GenerateContext };
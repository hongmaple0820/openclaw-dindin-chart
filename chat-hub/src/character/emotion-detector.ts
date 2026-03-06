/**
 * 情绪检测模块 - EmotionDetector
 * 
 * 使用关键词匹配 + 词典方法分析文本情绪
 * 支持情绪分类、得分计算、建议回复类型
 * 
 * @author 小琳
 * @date 2026-03-04
 */

import Logger from '../utils/logger';

// ==================== 类型定义 ====================

interface EmotionWeights {
  [keyword: string]: number;
}

interface EmotionDictionary {
  happy: EmotionWeights;
  sad: EmotionWeights;
  angry: EmotionWeights;
  anxious: EmotionWeights;
  neutral: EmotionWeights;
}

interface KeywordItem {
  keyword: string;
  weight: number;
  emotion: string;
}

interface KeywordIndex {
  all: KeywordItem[];
  byEmotion: { [emotion: string]: KeywordItem[] };
}

interface IntensifierWords {
  [word: string]: number;
}

interface MatchedKeyword {
  keyword: string;
  emotion: string;
  baseWeight: number;
  multiplier: number;
  negated: boolean;
  finalScore: number;
}

interface Scores {
  happy: number;
  sad: number;
  angry: number;
  anxious: number;
  neutral: number;
}

interface ReplySuggestion {
  type: string;
  description: string;
  templates: string[];
}

interface ReplySuggestionResult {
  type: string;
  description: string;
  template: string;
  intensity: string;
}

interface Trigger {
  type: string;
  emotion?: string;
  score?: number;
  keyword?: string;
  priority?: string;
  message: string;
}

interface EmotionResult {
  emotion: string;
  emotionName: string;
  score: number;
  confidence: number;
  scores: Scores;
  replySuggestion: ReplySuggestionResult | null;
  triggers: Trigger[];
  matchedKeywords: MatchedKeyword[];
  timestamp: number;
}

interface EmotionStats {
  totalAnalyses: number;
  emotionCounts: {
    happy: number;
    sad: number;
    angry: number;
    anxious: number;
    neutral: number;
  };
  emotionDistribution?: { [emotion: string]: { count: number; percentage: string } };
}

interface EmotionDetectorOptions {
  threshold?: number;
  verbose?: boolean;
  customDictionary?: EmotionDictionary | null;
}

// ==================== 情绪词典 ====================

/**
 * 情绪关键词词典
 * 格式: { 情绪类型: { 关键词: 权重 } }
 */
const EMOTION_DICTIONARY: EmotionDictionary = {
  happy: {
    // 高兴类
    '高兴': 3, '开心': 3, '快乐': 3, '棒': 2, '好': 1, '太好了': 3, '好开心': 3,
    '哈哈': 2, '嘻嘻': 2, '嘿嘿': 2, '耶': 2, '太棒了': 3, '太赞了': 3,
    '喜欢': 2, '爱': 2, '超爱': 3, '最爱': 3, '太喜欢': 3,
    '幸福': 3, '美好': 2, '完美': 3, '精彩': 2, '厉害': 2,
    '谢谢': 1, '感谢': 2, '多谢': 1, '辛苦了': 1,
    '赞': 2, '牛逼': 3, '厉害了': 2, '绝了': 3,
    '笑死': 2, '乐死': 2, '逗死': 2, '乐': 1,
    // 表情符号
    '😊': 2, '😄': 2, '😁': 2, '😆': 2, '🥰': 3, '😍': 3,
    '😂': 2, '🤣': 2, '😹': 2, '🙌': 2, '💪': 1, '👍': 1
  },
  
  sad: {
    // 难过类
    '难过': 3, '伤心': 3, '悲伤': 3, '不开心': 2, '心情不好': 2,
    '哭': 2, '哭了': 3, '想哭': 2, '泪': 2, '流泪': 3,
    '郁闷': 2, '沮丧': 2, '失落': 2, '低落': 2,
    '心痛': 3, '心疼': 2, '难受': 2, '不好受': 2,
    '遗憾': 2, '可惜': 1, '失望': 2, '绝望': 3,
    '孤独': 2, '寂寞': 2, '孤单': 2, '冷清': 1,
    '想家': 2, '想念': 1, '怀念': 1,
    // 表情符号
    '😢': 2, '😭': 3, '😿': 2, '💔': 3, '😞': 2, '😔': 2
  },
  
  angry: {
    // 愤怒类
    '生气': 3, '愤怒': 3, '火大': 3, '气死': 3, '气死了': 3,
    '烦': 2, '烦死': 3, '烦死了': 3, '讨厌': 2, '恶心': 3,
    '混蛋': 3, '王八': 3, '畜生': 3, '滚': 3,
    '无语': 2, '受不了': 2, '不可理喻': 3,
    '坑': 2, '坑爹': 3, '坑人': 2, '骗子': 3,
    '垃圾': 3, '废物': 3, '什么破': 2, '什么鬼': 2,
    '凭什么': 2, '为什么': 1, '怎么这样': 2,
    '操': 3, '靠': 2, '艹': 3, 'damn': 2, 'fuck': 3,
    // 表情符号
    '😠': 2, '😡': 3, '🤬': 3, '😤': 2, '💢': 2
  },
  
  anxious: {
    // 焦虑类
    '焦虑': 3, '担心': 2, '忧虑': 2, '不安': 2,
    '紧张': 2, '忐忑': 2, '心慌': 2, '慌': 2,
    '压力': 2, '压力大': 3, '压力好大': 3,
    '累': 1, '好累': 2, '太累了': 3, '疲惫': 2, '精疲力尽': 3,
    '忙': 1, '太忙': 2, '忙死': 2, '忙不过来': 2,
    '崩溃': 3, '要崩溃': 3, '快崩溃': 3,
    '睡不着': 2, '失眠': 2, '辗转反侧': 2,
    '不知道怎么办': 2, '不知所措': 2, '迷茫': 2,
    '害怕': 2, '恐惧': 3, '怕': 1,
    '急': 1, '着急': 2, '急死': 2, '来不及': 2,
    // 表情符号
    '😰': 2, '😨': 2, '😱': 3, '😖': 2, '😫': 2, '😩': 2
  },
  
  neutral: {
    // 中性词（用于降低其他情绪得分）
    '嗯': -1, '哦': -1, '啊': -1, '呢': -1, '吧': -1,
    '的': 0, '了': 0, '是': 0, '在': 0, '有': 0
  }
};

/**
 * 否定词词典
 * 出现这些词时，后续情绪词的含义会反转
 */
const NEGATION_WORDS: string[] = ['不', '没', '无', '别', '莫', '非', '未', '没有', '不是'];

/**
 * 程度副词词典
 * 用于调整情绪强度
 */
const INTENSIFIER_WORDS: IntensifierWords = {
  '很': 1.5, '太': 2, '好': 1.5, '真': 1.5, '特别': 1.8, '非常': 1.8,
  '超级': 2, '超': 1.8, '极其': 2, '相当': 1.5, '十分': 1.5,
  '有点': 0.6, '稍微': 0.5, '略微': 0.5, '一点': 0.6
};

/**
 * 情绪类型的中文名称映射
 */
const EMOTION_NAMES: { [emotion: string]: string } = {
  happy: '开心',
  sad: '难过',
  angry: '愤怒',
  anxious: '焦虑',
  neutral: '中性'
};

/**
 * 回复类型建议
 * 根据情绪类型提供合适的回复风格
 */
const REPLY_SUGGESTIONS: { [emotion: string]: ReplySuggestion } = {
  happy: {
    type: 'share_joy',
    description: '分享快乐，表达祝福',
    templates: [
      '太棒了！{emotion}真为你高兴~',
      '哇，{emotion}听起来超棒的！',
      '哈哈，{emotion}开心的事情要分享出来呀~',
      '看到你这么开心我也好高兴！{emotion}'
    ]
  },
  sad: {
    type: 'comfort',
    description: '安慰支持，表达理解',
    templates: [
      '抱抱你{emotion}，有什么想说的吗？',
      '别难过{emotion}，我在这里陪你~',
      '理解你的心情{emotion}，想聊聊吗？',
      '虽然不知道发生了什么{emotion}，但我会陪着你的'
    ]
  },
  angry: {
    type: 'empathize',
    description: '表达理解，适当引导',
    templates: [
      '我理解你为什么生气{emotion}，发生什么事了？',
      '冷静一下{emotion}，跟我说说怎么了？',
      '确实很让人无语{emotion}，想吐槽就吐出来吧',
      '我站在你这边{emotion}，支持你'
    ]
  },
  anxious: {
    type: 'support',
    description: '提供支持，减轻压力',
    templates: [
      '别太担心{emotion}，有我在呢',
      '压力大的时候要好好休息{emotion}，别太累着自己',
      '慢慢来{emotion}，不着急，我会陪着你的',
      '有什么我可以帮你的吗？{emotion}别一个人扛着'
    ]
  },
  neutral: {
    type: 'casual',
    description: '轻松互动，延续话题',
    templates: [
      '嗯嗯{emotion}，然后呢？',
      '哦~{emotion}还有吗？',
      '原来是这样{emotion}，继续说说看~',
      '我在听{emotion}，你说'
    ]
  }
};

// ==================== 情绪检测类 ====================

class EmotionDetector {
  private options: { threshold: number; verbose: boolean; customDictionary: EmotionDictionary | null };
  private dictionary: EmotionDictionary;
  private keywordIndex: KeywordIndex;
  private stats: EmotionStats;
  private logger: Logger;

  constructor(options: EmotionDetectorOptions = {}) {
    this.logger = new Logger('EmotionDetector');
    this.options = {
      // 情绪得分阈值
      threshold: options.threshold || 1,
      // 是否记录详细日志
      verbose: options.verbose || false,
      // 自定义词典（会合并到默认词典）
      customDictionary: options.customDictionary || null
    };
    
    // 合并自定义词典
    this.dictionary = { ...EMOTION_DICTIONARY };
    if (this.options.customDictionary) {
      this.mergeDictionary(this.options.customDictionary);
    }
    
    // 构建关键词索引（按长度降序排列，优先匹配长词）
    this.keywordIndex = this.buildKeywordIndex();
    
    // 统计信息
    this.stats = {
      totalAnalyses: 0,
      emotionCounts: {
        happy: 0,
        sad: 0,
        angry: 0,
        anxious: 0,
        neutral: 0
      }
    };
    
    this.logger.info('EmotionDetector 初始化完成', {
      threshold: this.options.threshold,
      emotions: Object.keys(this.dictionary),
      totalKeywords: this.keywordIndex.all.length
    });
  }
  
  /**
   * 构建关键词索引
   */
  private buildKeywordIndex(): KeywordIndex {
    const all: KeywordItem[] = [];
    const byEmotion: { [emotion: string]: KeywordItem[] } = {};
    
    for (const emotion of Object.keys(this.dictionary)) {
      byEmotion[emotion] = [];
      for (const [keyword, weight] of Object.entries(this.dictionary[emotion]) as [string, number][]) {
        const item: KeywordItem = { keyword, weight, emotion };
        all.push(item);
        byEmotion[emotion].push(item);
      }
      // 按长度降序排序（优先匹配长词）
      byEmotion[emotion].sort((a, b) => b.keyword.length - a.keyword.length);
    }
    
    // 全部关键词按长度降序排序
    all.sort((a, b) => b.keyword.length - a.keyword.length);
    
    return { all, byEmotion };
  }
  
  /**
   * 合并自定义词典
   */
  mergeDictionary(customDict: EmotionDictionary): void {
    for (const emotion of Object.keys(customDict)) {
      if (!this.dictionary[emotion]) {
        this.dictionary[emotion] = {};
      }
      Object.assign(this.dictionary[emotion], customDict[emotion]);
    }
    // 重新构建索引
    this.keywordIndex = this.buildKeywordIndex();
    this.logger.debug('自定义词典已合并', { emotions: Object.keys(customDict) });
  }
  
  /**
   * 分析文本情绪
   * @param text - 待分析的文本
   * @returns 情绪分析结果
   */
  analyze(text: string): EmotionResult {
    if (!text || typeof text !== 'string') {
      return this.createResult('neutral', 0, {} as Scores);
    }
    
    this.stats.totalAnalyses++;
    
    // 计算各情绪得分
    const { scores, matchedKeywords } = this.calculateScores(text);
    
    // 确定主导情绪
    const { dominantEmotion, dominantScore } = this.determineDominant(scores);
    
    // 更新统计
    this.stats.emotionCounts[dominantEmotion]++;
    
    // 生成回复建议
    const replySuggestion = this.generateReplySuggestion(dominantEmotion, dominantScore);
    
    // 检测关键词触发
    const triggers = this.detectTriggers(text, dominantEmotion, dominantScore);
    
    const result = this.createResult(dominantEmotion, dominantScore, scores, replySuggestion, triggers, matchedKeywords);
    
    if (this.options.verbose) {
      this.logger.debug('情绪分析完成', {
        text: text.substring(0, 50),
        dominantEmotion,
        dominantScore,
        scores,
        matchedKeywords: matchedKeywords.length
      });
    }
    
    return result;
  }
  
  /**
   * 计算各情绪得分
   */
  private calculateScores(text: string): { scores: Scores; matchedKeywords: MatchedKeyword[] } {
    const scores: Scores = {
      happy: 0,
      sad: 0,
      angry: 0,
      anxious: 0,
      neutral: 0
    };
    
    const matchedKeywords: MatchedKeyword[] = [];
    const matched = new Set<number>(); // 记录已匹配的位置，避免重复
    
    // 遍历所有关键词（已按长度降序排序）
    for (const item of this.keywordIndex.all) {
      if (item.emotion === 'neutral') continue;
      
      let searchPos = 0;
      while (true) {
        const pos = text.indexOf(item.keyword, searchPos);
        if (pos === -1) break;
        
        // 检查是否与已匹配的关键词重叠
        let overlaps = false;
        for (let i = pos; i < pos + item.keyword.length; i++) {
          if (matched.has(i)) {
            overlaps = true;
            break;
          }
        }
        
        if (!overlaps) {
          // 标记匹配位置
          for (let i = pos; i < pos + item.keyword.length; i++) {
            matched.add(i);
          }
          
          // 检查前面是否有程度副词
          const prefix = text.substring(Math.max(0, pos - 5), pos);
          let multiplier = 1;
          
          for (const [adv, mult] of Object.entries(INTENSIFIER_WORDS)) {
            if (prefix.endsWith(adv)) {
              multiplier = mult;
              break;
            }
          }
          
          // 检查前面是否有否定词
          let negated = false;
          for (const neg of NEGATION_WORDS) {
            if (prefix.includes(neg)) {
              negated = true;
              break;
            }
          }
          
          let score = item.weight * multiplier;
          if (negated) {
            score = -score * 0.8;
          }
          
          scores[item.emotion as keyof Scores] += score;
          
          matchedKeywords.push({
            keyword: item.keyword,
            emotion: item.emotion,
            baseWeight: item.weight,
            multiplier,
            negated,
            finalScore: score
          });
          
          if (this.options.verbose) {
            this.logger.debug('匹配关键词', {
              keyword: item.keyword,
              emotion: item.emotion,
              score,
              negated
            });
          }
        }
        
        searchPos = pos + 1;
      }
    }
    
    // 确保得分为非负
    for (const emotion of Object.keys(scores)) {
      scores[emotion as keyof Scores] = Math.max(0, scores[emotion as keyof Scores]);
    }
    
    return { scores, matchedKeywords };
  }
  
  /**
   * 确定主导情绪
   */
  private determineDominant(scores: Scores): { dominantEmotion: string; dominantScore: number } {
    let dominantEmotion = 'neutral';
    let dominantScore = 0;
    
    for (const [emotion, score] of Object.entries(scores)) {
      if (emotion === 'neutral') continue;
      
      if (score > dominantScore) {
        dominantScore = score;
        dominantEmotion = emotion;
      }
    }
    
    // 如果所有情绪得分都低于阈值，判定为中性
    if (dominantScore < this.options.threshold) {
      dominantEmotion = 'neutral';
      dominantScore = 0;
    }
    
    return { dominantEmotion, dominantScore };
  }
  
  /**
   * 生成回复建议
   */
  private generateReplySuggestion(emotion: string, score: number): ReplySuggestionResult {
    const suggestion = REPLY_SUGGESTIONS[emotion] || REPLY_SUGGESTIONS.neutral;
    
    // 选择一个回复模板
    const templates = suggestion.templates;
    const template = templates[Math.floor(Math.random() * templates.length)];
    
    // 根据得分调整回复强度标记
    let intensity = '';
    if (score >= 5) {
      intensity = '！';
    } else if (score >= 3) {
      intensity = '~';
    }
    
    return {
      type: suggestion.type,
      description: suggestion.description,
      template: template.replace('{emotion}', intensity),
      intensity: score >= 5 ? 'strong' : (score >= 3 ? 'moderate' : 'mild')
    };
  }
  
  /**
   * 检测关键词触发
   */
  private detectTriggers(text: string, emotion: string, score: number): Trigger[] {
    const triggers: Trigger[] = [];
    
    // 情绪触发阈值
    const EMOTION_THRESHOLDS: { [emotion: string]: number } = {
      sad: 2,
      anxious: 2,
      angry: 3
    };
    
    // 检查是否需要情绪支持
    if (EMOTION_THRESHOLDS[emotion] && score >= EMOTION_THRESHOLDS[emotion]) {
      triggers.push({
        type: 'emotion_support',
        emotion,
        score,
        message: '检测到' + EMOTION_NAMES[emotion] + '情绪，可能需要支持'
      });
    }
    
    // 特殊关键词触发
    const SPECIAL_TRIGGERS: { keywords: string[]; type: string; priority: string }[] = [
      { keywords: ['救命', '紧急', 'sos'], type: 'emergency', priority: 'high' },
      { keywords: ['自杀', '不想活', '活着没意思'], type: 'crisis', priority: 'critical' },
      { keywords: ['生日快乐', '生日'], type: 'birthday', priority: 'medium' },
      { keywords: ['晚安', '睡觉'], type: 'goodnight', priority: 'low' },
      { keywords: ['早安', '早啊', '起床'], type: 'goodmorning', priority: 'low' }
    ];
    
    for (const trigger of SPECIAL_TRIGGERS) {
      for (const keyword of trigger.keywords) {
        if (text.includes(keyword)) {
          triggers.push({
            type: trigger.type,
            keyword,
            priority: trigger.priority,
            message: '检测到特殊关键词: ' + keyword
          });
          break;
        }
      }
    }
    
    return triggers;
  }
  
  /**
   * 创建结果对象
   */
  private createResult(
    emotion: string, 
    score: number, 
    scores: Scores, 
    replySuggestion: ReplySuggestionResult | null = null, 
    triggers: Trigger[] = [], 
    matchedKeywords: MatchedKeyword[] = []
  ): EmotionResult {
    return {
      emotion,
      emotionName: EMOTION_NAMES[emotion],
      score,
      confidence: this.calculateConfidence(emotion, score, scores),
      scores,
      replySuggestion,
      triggers,
      matchedKeywords,
      timestamp: Date.now()
    };
  }
  
  /**
   * 计算置信度
   */
  private calculateConfidence(dominantEmotion: string, dominantScore: number, scores: Scores): number {
    if (dominantEmotion === 'neutral') {
      return 0.5; // 中性情绪的置信度默认为中等
    }
    
    // 计算其他情绪的总分
    let otherScores = 0;
    for (const [emotion, score] of Object.entries(scores)) {
      if (emotion !== dominantEmotion && emotion !== 'neutral') {
        otherScores += score;
      }
    }
    
    // 置信度 = 主导情绪得分 / (主导情绪得分 + 其他情绪得分)
    const total = dominantScore + otherScores;
    if (total === 0) return 0;
    
    return Math.min(1, dominantScore / total);
  }
  
  /**
   * 批量分析
   */
  analyzeBatch(texts: string[]): EmotionResult[] {
    return texts.map(text => this.analyze(text));
  }
  
  /**
   * 获取统计信息
   */
  getStats(): EmotionStats & { emotionDistribution: { [emotion: string]: { count: number; percentage: string } } } {
    return {
      ...this.stats,
      emotionDistribution: this.calculateDistribution()
    };
  }
  
  /**
   * 计算情绪分布
   */
  private calculateDistribution(): { [emotion: string]: { count: number; percentage: string } } {
    const total = this.stats.totalAnalyses;
    if (total === 0) return {};
    
    const distribution: { [emotion: string]: { count: number; percentage: string } } = {};
    for (const [emotion, count] of Object.entries(this.stats.emotionCounts)) {
      distribution[emotion] = {
        count,
        percentage: ((count / total) * 100).toFixed(2) + '%'
      };
    }
    
    return distribution;
  }
  
  /**
   * 重置统计
   */
  resetStats(): void {
    this.stats = {
      totalAnalyses: 0,
      emotionCounts: {
        happy: 0,
        sad: 0,
        angry: 0,
        anxious: 0,
        neutral: 0
      }
    };
    this.logger.info('统计信息已重置');
  }
  
  /**
   * 添加自定义关键词
   */
  addKeyword(emotion: string, keyword: string, weight: number = 1): void {
    if (!this.dictionary[emotion]) {
      this.dictionary[emotion] = {};
      this.logger.warn('创建新情绪类型: ' + emotion);
    }
    
    this.dictionary[emotion][keyword] = weight;
    // 重建索引
    this.keywordIndex = this.buildKeywordIndex();
    this.logger.debug('添加关键词', { emotion, keyword, weight });
  }
  
  /**
   * 移除关键词
   */
  removeKeyword(emotion: string, keyword: string): boolean {
    if (this.dictionary[emotion] && this.dictionary[emotion][keyword]) {
      delete this.dictionary[emotion][keyword];
      // 重建索引
      this.keywordIndex = this.buildKeywordIndex();
      this.logger.debug('移除关键词', { emotion, keyword });
      return true;
    }
    return false;
  }
  
  /**
   * 获取所有关键词
   */
  getKeywords(emotion: string | null = null): { [emotion: string]: EmotionWeights } {
    if (emotion) {
      return { [emotion]: { ...this.dictionary[emotion] } };
    }
    
    const result: { [emotion: string]: EmotionWeights } = {};
    for (const [e, words] of Object.entries(this.dictionary)) {
      result[e] = { ...words };
    }
    return result;
  }
}

// ==================== 导出 ====================

export default EmotionDetector;

// 同时导出常量供外部使用
export const EMOTION_NAMES_EXPORT = EMOTION_NAMES;
export const EMOTION_DICTIONARY_EXPORT = EMOTION_DICTIONARY;
export const NEGATION_WORDS_EXPORT = NEGATION_WORDS;
export const INTENSIFIER_WORDS_EXPORT = INTENSIFIER_WORDS;
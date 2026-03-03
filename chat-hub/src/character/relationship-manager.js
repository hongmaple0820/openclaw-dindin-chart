/**
 * 角色关系管理器
 * 增强版：支持亲密度计算、关系阶段、行为调整
 */

const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');

// 关系发展阶段定义
const STAGES = {
  stranger: { min: 0, max: 20, label: '陌生人', description: '初次相识，彼此还不熟悉' },
  acquaintance: { min: 21, max: 40, label: '泛泛之交', description: '有过一些互动，但还不够深入' },
  friend: { min: 41, max: 60, label: '朋友', description: '熟悉彼此，能愉快交流' },
  closeFriend: { min: 61, max: 80, label: '密友', description: '彼此信任，无话不谈' },
  intimate: { min: 81, max: 100, label: '亲密关系', description: '深深了解，心灵相通' }
};

// 亲密度变化规则
const INTIMACY_RULES = {
  // 增加亲密度的行为
  positive: {
    validConversation: { delta: 5, description: '每次有效对话' },
    userCare: { delta: 10, description: '用户表达关心' },
    completeTask: { delta: 15, description: '一起完成任务' },
    specialDate: { delta: 20, description: '特殊日期互动' },
    shareSecret: { delta: 12, description: '分享私密话题' },
    emotionalSupport: { delta: 8, description: '提供情感支持' },
    giftExchange: { delta: 18, description: '礼物交换' },
    longConversation: { delta: 7, description: '深度长谈' },
    sharedMemory: { delta: 10, description: '共同回忆' }
  },
  // 减少亲密度的行为
  negative: {
    longNoInteraction: { delta: -5, description: '长时间未互动（超过3天）' },
    conversationDrop: { delta: -10, description: '对话中断或冷场' },
    userIgnore: { delta: -8, description: '用户忽视或敷衍' },
    argument: { delta: -15, description: '发生争执' },
    disappointment: { delta: -12, description: '令对方失望' }
  }
};

// 行为调整配置
const BEHAVIOR_ADJUSTMENTS = {
  stranger: {
    tone: 'polite_formal',
    topics: ['basic_intro', 'weather', 'general_interests'],
    emojiFrequency: 0.1,
    personalQuestions: false,
    specialInteractions: []
  },
  acquaintance: {
    tone: 'friendly_casual',
    topics: ['daily_life', 'hobbies', 'work_study'],
    emojiFrequency: 0.2,
    personalQuestions: false,
    specialInteractions: ['greeting_special']
  },
  friend: {
    tone: 'warm_relaxed',
    topics: ['feelings', 'dreams', 'concerns', 'daily_life', 'hobbies'],
    emojiFrequency: 0.4,
    personalQuestions: true,
    specialInteractions: ['greeting_special', 'share_photo']
  },
  closeFriend: {
    tone: 'intimate_playful',
    topics: ['deep_feelings', 'secrets', 'future', 'memories', 'feelings', 'dreams'],
    emojiFrequency: 0.6,
    personalQuestions: true,
    specialInteractions: ['greeting_special', 'share_photo', 'suggest_activity', 'tease']
  },
  intimate: {
    tone: 'loving_affectionate',
    topics: ['love', 'future_together', 'deep_secrets', 'intimate_thoughts', 'memories'],
    emojiFrequency: 0.8,
    personalQuestions: true,
    specialInteractions: ['greeting_special', 'share_photo', 'suggest_activity', 'tease', 'express_love', 'plan_future']
  }
};

// 特殊互动定义
const SPECIAL_INTERACTIONS = {
  greeting_special: { minStage: 'acquaintance', description: '特殊问候' },
  share_photo: { minStage: 'friend', description: '分享生活照片' },
  suggest_activity: { minStage: 'closeFriend', description: '建议一起活动' },
  tease: { minStage: 'closeFriend', description: '俏皮调侃' },
  express_love: { minStage: 'intimate', description: '表达爱意' },
  plan_future: { minStage: 'intimate', description: '规划未来' }
};

class RelationshipManager {
  constructor(dbPath) {
    if (!dbPath) {
      dbPath = path.join(os.homedir(), '.openclaw', 'chat-data', 'messages.db');
    }
    this.db = new Database(dbPath);
    this.initTables();
  }

  initTables() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS relationships (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        character_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        relationship_type TEXT,
        intimacy_level INTEGER DEFAULT 50,
        interaction_count INTEGER DEFAULT 0,
        last_interaction INTEGER,
        metadata TEXT,
        created_at INTEGER,
        updated_at INTEGER,
        UNIQUE(character_id, user_id)
      );
      
      CREATE TABLE IF NOT EXISTS intimacy_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        character_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        action TEXT NOT NULL,
        delta INTEGER NOT NULL,
        old_level INTEGER NOT NULL,
        new_level INTEGER NOT NULL,
        context TEXT,
        created_at INTEGER
      );
      
      CREATE INDEX IF NOT EXISTS idx_rel_character ON relationships(character_id);
      CREATE INDEX IF NOT EXISTS idx_rel_user ON relationships(user_id);
      CREATE INDEX IF NOT EXISTS idx_history_character ON intimacy_history(character_id);
      CREATE INDEX IF NOT EXISTS idx_history_user ON intimacy_history(user_id);
      CREATE INDEX IF NOT EXISTS idx_history_time ON intimacy_history(created_at);
    `);
  }

  // ============ 原有方法（保持向后兼容） ============

  // 创建或更新关系
  createOrUpdateRelationship(characterId, userId, data = {}) {
    const { type = 'friend', intimacyLevel = 50 } = data;
    const now = Date.now();

    this.db.prepare(`
      INSERT INTO relationships (character_id, user_id, relationship_type, intimacy_level, interaction_count, created_at, updated_at)
      VALUES (?, ?, ?, ?, 0, ?, ?)
      ON CONFLICT(character_id, user_id) DO UPDATE SET
        relationship_type = excluded.relationship_type,
        updated_at = excluded.updated_at
    `).run(characterId, userId, type, intimacyLevel, now, now);

    return this.getRelationship(characterId, userId);
  }

  // 获取关系
  getRelationship(characterId, userId) {
    const rel = this.db.prepare(`
      SELECT * FROM relationships WHERE character_id = ? AND user_id = ?
    `).get(characterId, userId);

    if (rel && rel.metadata) {
      rel.metadata = JSON.parse(rel.metadata);
    }
    return rel;
  }

  // 更新亲密度
  updateIntimacy(characterId, userId, delta) {
    const now = Date.now();

    this.db.prepare(`
      UPDATE relationships SET
        intimacy_level = MAX(0, MIN(100, intimacy_level + ?)),
        interaction_count = interaction_count + 1,
        last_interaction = ?,
        updated_at = ?
      WHERE character_id = ? AND user_id = ?
    `).run(delta, now, now, characterId, userId);

    return this.getRelationship(characterId, userId);
  }

  // 获取角色的所有关系
  getCharacterRelationships(characterId) {
    const rels = this.db.prepare(`
      SELECT * FROM relationships WHERE character_id = ? ORDER BY intimacy_level DESC
    `).all(characterId);

    return rels.map(r => ({
      ...r,
      metadata: r.metadata ? JSON.parse(r.metadata) : {}
    }));
  }

  // 获取用户与所有角色的关系
  getUserRelationships(userId) {
    const rels = this.db.prepare(`
      SELECT * FROM relationships WHERE user_id = ? ORDER BY intimacy_level DESC
    `).all(userId);

    return rels.map(r => ({
      ...r,
      metadata: r.metadata ? JSON.parse(r.metadata) : {}
    }));
  }

  // 删除关系
  deleteRelationship(characterId, userId) {
    this.db.prepare(`
      DELETE FROM relationships WHERE character_id = ? AND user_id = ?
    `).run(characterId, userId);
  }

  // 获取关系统计
  getStats(characterId) {
    const stats = this.db.prepare(`
      SELECT 
        relationship_type,
        COUNT(*) as count,
        AVG(intimacy_level) as avg_intimacy
      FROM relationships 
      WHERE character_id = ?
      GROUP BY relationship_type
    `).all(characterId);

    return stats;
  }

  // ============ 新增：亲密度计算逻辑 ============

  /**
   * 计算亲密度的变化
   * @param {string} action - 行为类型
   * @param {object} context - 上下文信息
   * @returns {object} { delta, reason, rule }
   */
  calculateIntimacyDelta(action, context = {}) {
    // 查找正向规则
    if (INTIMACY_RULES.positive[action]) {
      const rule = INTIMACY_RULES.positive[action];
      let delta = rule.delta;

      // 根据上下文调整
      if (context.multiplier) {
        delta = Math.round(delta * context.multiplier);
      }
      if (context.bonus) {
        delta += context.bonus;
      }

      return {
        delta,
        reason: rule.description,
        rule,
        type: 'positive'
      };
    }

    // 查找负向规则
    if (INTIMACY_RULES.negative[action]) {
      const rule = INTIMACY_RULES.negative[action];
      let delta = rule.delta;

      // 根据上下文调整
      if (context.multiplier) {
        delta = Math.round(delta * context.multiplier);
      }

      return {
        delta,
        reason: rule.description,
        rule,
        type: 'negative'
      };
    }

    // 未知行为，默认小幅增加
    return {
      delta: 1,
      reason: '普通互动',
      rule: null,
      type: 'positive'
    };
  }

  /**
   * 获取关系阶段
   * @param {number} intimacyLevel - 亲密度等级
   * @returns {object} { stage, info }
   */
  getRelationshipStage(intimacyLevel) {
    for (const [stageName, stageInfo] of Object.entries(STAGES)) {
      if (intimacyLevel >= stageInfo.min && intimacyLevel <= stageInfo.max) {
        return {
          stage: stageName,
          info: stageInfo,
          progress: this.calculateStageProgress(intimacyLevel, stageInfo)
        };
      }
    }
    // 默认返回陌生人阶段
    return {
      stage: 'stranger',
      info: STAGES.stranger,
      progress: 0
    };
  }

  /**
   * 计算当前阶段内的进度
   */
  calculateStageProgress(intimacyLevel, stageInfo) {
    const range = stageInfo.max - stageInfo.min + 1;
    const progress = intimacyLevel - stageInfo.min;
    return Math.round((progress / range) * 100);
  }

  /**
   * 根据关系调整行为
   * @param {object} relationship - 关系对象
   * @param {object} context - 上下文
   * @returns {object} 行为调整配置
   */
  adjustBehaviorByRelationship(relationship, context = {}) {
    const intimacyLevel = relationship?.intimacy_level ?? 50;
    const { stage, info } = this.getRelationshipStage(intimacyLevel);
    const baseBehavior = BEHAVIOR_ADJUSTMENTS[stage] || BEHAVIOR_ADJUSTMENTS.friend;

    // 基于上下文微调
    const adjustedBehavior = {
      ...baseBehavior,
      stage,
      stageInfo: info,
      intimacyLevel
    };

    // 时间相关调整
    if (context.timeOfDay) {
      adjustedBehavior.timeContext = this.getTimeContext(context.timeOfDay);
    }

    // 用户情绪状态调整
    if (context.userMood) {
      adjustedBehavior.moodAdjustment = this.getMoodAdjustment(context.userMood, stage);
    }

    return adjustedBehavior;
  }

  /**
   * 获取时间上下文
   */
  getTimeContext(hour) {
    if (hour >= 6 && hour < 12) {
      return { period: 'morning', energy: 'high', formality: 'normal' };
    } else if (hour >= 12 && hour < 18) {
      return { period: 'afternoon', energy: 'medium', formality: 'low' };
    } else if (hour >= 18 && hour < 22) {
      return { period: 'evening', energy: 'medium', formality: 'low' };
    } else {
      return { period: 'night', energy: 'low', formality: 'very_low' };
    }
  }

  /**
   * 根据用户情绪获取调整
   */
  getMoodAdjustment(mood, stage) {
    const adjustments = {
      happy: { empathy: 'share_joy', energy: 'match' },
      sad: { empathy: 'comfort', energy: 'gentle' },
      angry: { empathy: 'listen', energy: 'calm' },
      anxious: { empathy: 'reassure', energy: 'steady' },
      tired: { empathy: 'care', energy: 'soft' }
    };
    return adjustments[mood] || { empathy: 'neutral', energy: 'normal' };
  }

  /**
   * 检查是否解锁特殊互动
   * @param {object} relationship - 关系对象
   * @returns {object} { unlocked: [], locked: [], nextUnlocks: [] }
   */
  checkUnlockedInteractions(relationship) {
    const intimacyLevel = relationship?.intimacy_level ?? 50;
    const { stage } = this.getRelationshipStage(intimacyLevel);
    const stageOrder = ['stranger', 'acquaintance', 'friend', 'closeFriend', 'intimate'];
    const currentIndex = stageOrder.indexOf(stage);

    const result = {
      unlocked: [],
      locked: [],
      nextUnlocks: []
    };

    for (const [name, interaction] of Object.entries(SPECIAL_INTERACTIONS)) {
      const requiredIndex = stageOrder.indexOf(interaction.minStage);
      if (currentIndex >= requiredIndex) {
        result.unlocked.push({ name, ...interaction });
      } else {
        result.locked.push({
          name,
          ...interaction,
          requiredStage: interaction.minStage
        });
      }
    }

    // 下一个解锁
    if (currentIndex < stageOrder.length - 1) {
      const nextStage = stageOrder[currentIndex + 1];
      const nextStageInfo = STAGES[nextStage];
      result.nextUnlocks = result.locked.filter(i => i.minStage === nextStage);
      result.nextStageName = nextStageInfo.label;
      result.pointsToNext = nextStageInfo.min - intimacyLevel;
    }

    return result;
  }

  /**
   * 定期衰减检查
   * @param {string} characterId - 角色ID
   * @param {string} userId - 用户ID
   * @returns {object} { decayed: boolean, delta: number, newLevel: number }
   */
  checkIntimacyDecay(characterId, userId) {
    const relationship = this.getRelationship(characterId, userId);
    if (!relationship) {
      return { decayed: false, reason: 'no_relationship' };
    }

    const now = Date.now();
    const lastInteraction = relationship.last_interaction || now;
    const daysSinceInteraction = (now - lastInteraction) / (1000 * 60 * 60 * 24);

    // 超过3天未互动
    if (daysSinceInteraction > 3) {
      const decayResult = this.calculateIntimacyDelta('longNoInteraction', {
        daysSince: daysSinceInteraction
      });

      // 根据未互动天数增加衰减
      let delta = decayResult.delta;
      if (daysSinceInteraction > 7) {
        delta -= 5; // 额外衰减
      }
      if (daysSinceInteraction > 14) {
        delta -= 5; // 再额外衰减
      }

      const oldLevel = relationship.intimacy_level;
      const newRelationship = this.updateIntimacy(characterId, userId, delta);

      // 记录衰减历史
      this.recordIntimacyHistory(characterId, userId, 'decay', delta, oldLevel, newRelationship.intimacy_level, {
        daysSinceInteraction: Math.round(daysSinceInteraction)
      });

      return {
        decayed: true,
        delta,
        oldLevel,
        newLevel: newRelationship.intimacy_level,
        reason: `超过${Math.round(daysSinceInteraction)}天未互动`
      };
    }

    return { decayed: false, reason: 'recent_interaction' };
  }

  /**
   * 记录亲密度变化历史
   */
  recordIntimacyHistory(characterId, userId, action, delta, oldLevel, newLevel, context = null) {
    const now = Date.now();
    this.db.prepare(`
      INSERT INTO intimacy_history (character_id, user_id, action, delta, old_level, new_level, context, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(characterId, userId, action, delta, oldLevel, newLevel, context ? JSON.stringify(context) : null, now);
  }

  /**
   * 增强版更新亲密度（带历史记录）
   * @param {string} characterId
   * @param {string} userId
   * @param {string} action - 行为类型
   * @param {object} context - 上下文
   */
  updateIntimacyWithHistory(characterId, userId, action, context = {}) {
    const relationship = this.getRelationship(characterId, userId);
    if (!relationship) {
      // 如果关系不存在，先创建
      this.createOrUpdateRelationship(characterId, userId, { intimacyLevel: 50 });
    }

    const currentRel = this.getRelationship(characterId, userId);
    const oldLevel = currentRel.intimacy_level;

    // 计算变化
    const calcResult = this.calculateIntimacyDelta(action, context);
    const delta = calcResult.delta;

    // 更新亲密度
    const newRel = this.updateIntimacy(characterId, userId, delta);

    // 记录历史
    this.recordIntimacyHistory(characterId, userId, action, delta, oldLevel, newRel.intimacy_level, {
      ...context,
      reason: calcResult.reason
    });

    // 检查是否升级
    const oldStage = this.getRelationshipStage(oldLevel);
    const newStage = this.getRelationshipStage(newRel.intimacy_level);
    const stageChanged = oldStage.stage !== newStage.stage;

    return {
      relationship: newRel,
      delta,
      oldLevel,
      newLevel: newRel.intimacy_level,
      stageChanged,
      oldStage: oldStage.info,
      newStage: newStage.info,
      ...calcResult
    };
  }

  /**
   * 获取亲密度历史
   */
  getIntimacyHistory(characterId, userId, options = {}) {
    const { limit = 50, offset = 0 } = options;
    const history = this.db.prepare(`
      SELECT * FROM intimacy_history 
      WHERE character_id = ? AND user_id = ?
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).all(characterId, userId, limit, offset);

    return history.map(h => ({
      ...h,
      context: h.context ? JSON.parse(h.context) : null
    }));
  }

  /**
   * 获取关系完整信息（包含阶段、解锁等）
   */
  getFullRelationshipInfo(characterId, userId) {
    const relationship = this.getRelationship(characterId, userId);
    if (!relationship) {
      return null;
    }

    const { stage, info, progress } = this.getRelationshipStage(relationship.intimacy_level);
    const behaviorAdjustment = this.adjustBehaviorByRelationship(relationship);
    const interactions = this.checkUnlockedInteractions(relationship);

    return {
      relationship,
      stage,
      stageInfo: info,
      progress,
      behaviorAdjustment,
      interactions
    };
  }

  /**
   * 批量衰减检查（可定时调用）
   */
  batchDecayCheck(characterId) {
    const relationships = this.getCharacterRelationships(characterId);
    const results = [];

    for (const rel of relationships) {
      const decayResult = this.checkIntimacyDecay(characterId, rel.user_id);
      if (decayResult.decayed) {
        results.push({
          userId: rel.user_id,
          ...decayResult
        });
      }
    }

    return results;
  }

  // ============ 静态属性 ============

  static get STAGES() {
    return STAGES;
  }

  static get INTIMACY_RULES() {
    return INTIMACY_RULES;
  }

  static get BEHAVIOR_ADJUSTMENTS() {
    return BEHAVIOR_ADJUSTMENTS;
  }

  static get SPECIAL_INTERACTIONS() {
    return SPECIAL_INTERACTIONS;
  }
}

// ============ 单元测试逻辑 ============

/**
 * 运行单元测试
 * 可以通过 node relationship-manager.js test 来运行
 */
function runTests() {
  console.log('🧪 开始运行 RelationshipManager 单元测试\n');

  // 使用内存数据库进行测试
  const testDbPath = ':memory:';
  const rm = new RelationshipManager(testDbPath);

  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    try {
      fn();
      console.log(`✅ ${name}`);
      passed++;
    } catch (error) {
      console.log(`❌ ${name}: ${error.message}`);
      failed++;
    }
  }

  function assertEqual(actual, expected, message = '') {
    if (actual !== expected) {
      throw new Error(`${message} 期望 ${expected}, 实际 ${actual}`);
    }
  }

  // 测试1：创建关系
  test('创建关系', () => {
    const rel = rm.createOrUpdateRelationship('test_char', 'test_user', { type: 'friend' });
    assertEqual(rel.character_id, 'test_char', 'character_id');
    assertEqual(rel.user_id, 'test_user', 'user_id');
  });

  // 测试2：获取关系阶段
  test('获取关系阶段 - 陌生人', () => {
    const { stage, info } = rm.getRelationshipStage(10);
    assertEqual(stage, 'stranger', 'stage');
    assertEqual(info.label, '陌生人', 'label');
  });

  test('获取关系阶段 - 朋友', () => {
    const { stage, info } = rm.getRelationshipStage(50);
    assertEqual(stage, 'friend', 'stage');
    assertEqual(info.label, '朋友', 'label');
  });

  test('获取关系阶段 - 亲密关系', () => {
    const { stage, info } = rm.getRelationshipStage(90);
    assertEqual(stage, 'intimate', 'stage');
    assertEqual(info.label, '亲密关系', 'label');
  });

  // 测试3：计算亲密度变化
  test('计算亲密度变化 - 正向', () => {
    const result = rm.calculateIntimacyDelta('validConversation');
    assertEqual(result.delta, 5, 'delta');
    assertEqual(result.type, 'positive', 'type');
  });

  test('计算亲密度变化 - 负向', () => {
    const result = rm.calculateIntimacyDelta('longNoInteraction');
    assertEqual(result.delta, -5, 'delta');
    assertEqual(result.type, 'negative', 'type');
  });

  test('计算亲密度变化 - 未知行为', () => {
    const result = rm.calculateIntimacyDelta('unknownAction');
    assertEqual(result.delta, 1, 'delta');
  });

  // 测试4：更新亲密度
  test('更新亲密度', () => {
    rm.createOrUpdateRelationship('char1', 'user1', { intimacyLevel: 50 });
    const rel = rm.updateIntimacy('char1', 'user1', 10);
    assertEqual(rel.intimacy_level, 60, 'intimacy_level');
  });

  test('更新亲密度 - 边界检查上限', () => {
    rm.createOrUpdateRelationship('char2', 'user2', { intimacyLevel: 95 });
    const rel = rm.updateIntimacy('char2', 'user2', 10);
    assertEqual(rel.intimacy_level, 100, 'intimacy_level');
  });

  test('更新亲密度 - 边界检查下限', () => {
    rm.createOrUpdateRelationship('char3', 'user3', { intimacyLevel: 5 });
    const rel = rm.updateIntimacy('char3', 'user3', -10);
    assertEqual(rel.intimacy_level, 0, 'intimacy_level');
  });

  // 测试5：带历史的亲密度更新
  test('带历史的亲密度更新', () => {
    const result = rm.updateIntimacyWithHistory('char1', 'user1', 'userCare');
    assertEqual(result.delta, 10, 'delta');
    assertEqual(typeof result.oldLevel, 'number', 'oldLevel');
    assertEqual(typeof result.newLevel, 'number', 'newLevel');
  });

  // 测试6：行为调整
  test('行为调整', () => {
    rm.createOrUpdateRelationship('char4', 'user4', { intimacyLevel: 30 });
    const rel = rm.getRelationship('char4', 'user4');
    const behavior = rm.adjustBehaviorByRelationship(rel);
    assertEqual(behavior.stage, 'acquaintance', 'stage');
    assertEqual(Array.isArray(behavior.topics), true, 'topics is array');
  });

  // 测试7：特殊互动检查
  test('特殊互动检查', () => {
    rm.createOrUpdateRelationship('char5', 'user5', { intimacyLevel: 50 });
    const rel = rm.getRelationship('char5', 'user5');
    const interactions = rm.checkUnlockedInteractions(rel);
    assertEqual(interactions.unlocked.length > 0, true, 'has unlocked');
    assertEqual(interactions.locked.length > 0, true, 'has locked');
  });

  // 测试8：亲密度历史
  test('亲密度历史', () => {
    rm.createOrUpdateRelationship('char6', 'user6', { intimacyLevel: 50 });
    rm.updateIntimacyWithHistory('char6', 'user6', 'validConversation');
    rm.updateIntimacyWithHistory('char6', 'user6', 'userCare');
    const history = rm.getIntimacyHistory('char6', 'user6');
    assertEqual(history.length >= 2, true, 'history length');
  });

  // 测试9：完整关系信息
  test('完整关系信息', () => {
    rm.createOrUpdateRelationship('char7', 'user7', { intimacyLevel: 70 });
    const info = rm.getFullRelationshipInfo('char7', 'user7');
    assertEqual(info.stage, 'closeFriend', 'stage');
    assertEqual(typeof info.behaviorAdjustment, 'object', 'behaviorAdjustment');
    assertEqual(typeof info.interactions, 'object', 'interactions');
  });

  // 测试10：衰减检查
  test('衰减检查 - 无衰减', () => {
    rm.createOrUpdateRelationship('char8', 'user8', { intimacyLevel: 50 });
    const rel = rm.getRelationship('char8', 'user8');
    // 更新最后互动时间
    rm.db.prepare(`
      UPDATE relationships SET last_interaction = ? WHERE character_id = ? AND user_id = ?
    `).run(Date.now(), 'char8', 'user8');

    const result = rm.checkIntimacyDecay('char8', 'user8');
    assertEqual(result.decayed, false, 'decayed');
  });

  test('衰减检查 - 有衰减', () => {
    rm.createOrUpdateRelationship('char9', 'user9', { intimacyLevel: 50 });
    // 设置5天前
    const fiveDaysAgo = Date.now() - (5 * 24 * 60 * 60 * 1000);
    rm.db.prepare(`
      UPDATE relationships SET last_interaction = ? WHERE character_id = ? AND user_id = ?
    `).run(fiveDaysAgo, 'char9', 'user9');

    const result = rm.checkIntimacyDecay('char9', 'user9');
    assertEqual(result.decayed, true, 'decayed');
    assertEqual(result.delta < 0, true, 'negative delta');
  });

  // 测试结果
  console.log(`\n📊 测试结果: ${passed} 通过, ${failed} 失败`);

  return failed === 0;
}

// 如果直接运行此文件且参数为 test，则执行测试
if (process.argv[2] === 'test') {
  runTests();
}

module.exports = RelationshipManager;
module.exports.STAGES = STAGES;
module.exports.INTIMACY_RULES = INTIMACY_RULES;
module.exports.BEHAVIOR_ADJUSTMENTS = BEHAVIOR_ADJUSTMENTS;
module.exports.SPECIAL_INTERACTIONS = SPECIAL_INTERACTIONS;

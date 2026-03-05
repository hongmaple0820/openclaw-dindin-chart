/**
 * Skills Service - 技能服务 (TypeScript)
 * 
 * 管理内置技能、云市场技能、用户技能
 */

import { v4 as uuidv4 } from 'uuid';
import type { 
  Skill, 
  MarketplaceSkill, 
  UserSkill, 
  CustomSkill,
  ApiResponse,
  DbWrapper 
} from '../types/skills';

export class SkillsService {
  private db: DbWrapper;

  constructor(db: DbWrapper) {
    this.db = db;
  }

  // ==================== 内置技能 ====================

  /**
   * 获取内置技能列表
   */
  async getBuiltinSkills(filters: { category?: string } = {}): Promise<Skill[]> {
    let sql = 'SELECT * FROM builtin_skills WHERE enabled = 1';
    const params: string[] = [];

    if (filters.category) {
      sql += ' AND category = ?';
      params.push(filters.category);
    }

    sql += ' ORDER BY order_index ASC, name ASC';

    const rows = await this.db.all(sql, params);
    return rows.map(row => this.formatSkill(row as Record<string, unknown>));
  }

  /**
   * 获取内置技能详情
   */
  async getBuiltinSkill(id: string): Promise<Skill | null> {
    const row = await this.db.get('SELECT * FROM builtin_skills WHERE id = ?', [id]);
    return row ? this.formatSkill(row as Record<string, unknown>) : null;
  }

  /**
   * 添加内置技能（管理员）
   */
  async addBuiltinSkill(skill: Partial<Skill>): Promise<Skill | null> {
    const id = skill.id || uuidv4();
    const now = Date.now();

    await this.db.run(`
      INSERT INTO builtin_skills (
        id, name, display_name, description, version, author,
        category, tags, skill_content, config_schema, default_config,
        enabled, order_index, icon, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id, 
      skill.name || '', 
      skill.display_name || skill.name || '',
      skill.description || '', 
      skill.version || '1.0.0', 
      skill.author || 'system',
      skill.category || 'general', 
      JSON.stringify(skill.tags || []),
      skill.skill_content || '', 
      JSON.stringify(skill.config_schema || {}),
      JSON.stringify(skill.default_config || {}),
      skill.enabled !== false ? 1 : 0, 
      skill.order_index || 0,
      skill.icon || '', 
      now, 
      now
    ]);

    return this.getBuiltinSkill(id);
  }

  // ==================== 云市场技能 ====================

  /**
   * 获取云市场技能列表
   */
  async getMarketplaceSkills(filters: { 
    category?: string; 
    search?: string; 
    limit?: number 
  } = {}): Promise<MarketplaceSkill[]> {
    let sql = "SELECT * FROM marketplace_skills WHERE status = 'approved'";
    const params: (string | number)[] = [];

    if (filters.category) {
      sql += ' AND category = ?';
      params.push(filters.category);
    }

    if (filters.search) {
      sql += ' AND (name LIKE ? OR description LIKE ?)';
      params.push(`%${filters.search}%`, `%${filters.search}%`);
    }

    sql += ' ORDER BY downloads DESC, rating DESC, created_at DESC';

    if (filters.limit) {
      sql += ' LIMIT ?';
      params.push(filters.limit);
    }

    const rows = await this.db.all(sql, params);
    return rows.map(row => this.formatSkill(row as Record<string, unknown>) as MarketplaceSkill);
  }

  /**
   * 获取云市场技能详情
   */
  async getMarketplaceSkill(id: string): Promise<MarketplaceSkill | null> {
    const row = await this.db.get(
      "SELECT * FROM marketplace_skills WHERE id = ? AND status = 'approved'",
      [id]
    );
    return row ? this.formatSkill(row as Record<string, unknown>) as MarketplaceSkill : null;
  }

  /**
   * 安装云市场技能
   */
  async installSkill(userId: string, skillId: string): Promise<ApiResponse<Skill>> {
    // 检查是否已安装
    const existing = await this.db.get(
      'SELECT * FROM user_skills WHERE user_id = ? AND skill_id = ?',
      [userId, skillId]
    );

    if (existing) {
      return { success: false, error: 'Skill already installed' };
    }

    // 获取技能信息
    const skill = await this.getMarketplaceSkill(skillId);
    if (!skill) {
      return { success: false, error: 'Skill not found' };
    }

    // 安装
    const now = Date.now();
    await this.db.run(`
      INSERT INTO user_skills (user_id, skill_id, skill_type, enabled, installed_at)
      VALUES (?, ?, 'marketplace', 1, ?)
    `, [userId, skillId, now]);

    // 更新安装数
    await this.db.run(
      'UPDATE marketplace_skills SET installs = installs + 1 WHERE id = ?',
      [skillId]
    );

    return { success: true, data: skill };
  }

  /**
   * 提交技能到云市场
   */
  async submitToMarketplace(
    userId: string, 
    skillData: Partial<MarketplaceSkill>
  ): Promise<ApiResponse<{ id: string; status: string }>> {
    const id = uuidv4();
    const now = Date.now();

    await this.db.run(`
      INSERT INTO marketplace_skills (
        id, name, display_name, description, version,
        author_id, author_name, category, tags, skill_content,
        config_schema, default_config, status, icon, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)
    `, [
      id, 
      skillData.name || '', 
      skillData.display_name || skillData.name || '',
      skillData.description || '', 
      skillData.version || '1.0.0',
      userId, 
      skillData.author_name || '',
      skillData.category || 'general', 
      JSON.stringify(skillData.tags || []),
      skillData.skill_content || '',
      JSON.stringify(skillData.config_schema || {}),
      JSON.stringify(skillData.default_config || {}),
      skillData.icon || '', 
      now, 
      now
    ]);

    return { success: true, data: { id, status: 'pending' } };
  }

  // ==================== 用户技能 ====================

  /**
   * 获取用户安装的技能
   */
  async getUserSkills(userId: string): Promise<UserSkill[]> {
    const rows = await this.db.all(`
      SELECT us.*, 
        CASE 
          WHEN us.skill_type = 'builtin' THEN (SELECT name FROM builtin_skills WHERE id = us.skill_id)
          WHEN us.skill_type = 'marketplace' THEN (SELECT name FROM marketplace_skills WHERE id = us.skill_id)
          WHEN us.skill_type = 'custom' THEN (SELECT name FROM custom_skills WHERE id = us.skill_id)
        END as skill_name
      FROM user_skills us
      WHERE us.user_id = ?
      ORDER BY us.installed_at DESC
    `, [userId]);

    return rows as UserSkill[];
  }

  /**
   * 获取用户自建技能
   */
  async getCustomSkills(userId: string): Promise<CustomSkill[]> {
    const rows = await this.db.all(
      'SELECT * FROM custom_skills WHERE user_id = ? ORDER BY created_at DESC',
      [userId]
    );
    return rows.map(row => this.formatSkill(row as Record<string, unknown>) as CustomSkill);
  }

  /**
   * 创建自建技能
   */
  async createCustomSkill(
    userId: string, 
    skillData: Partial<CustomSkill>
  ): Promise<CustomSkill | null> {
    const id = uuidv4();
    const now = Date.now();

    await this.db.run(`
      INSERT INTO custom_skills (
        id, user_id, name, display_name, description, version,
        category, tags, skill_content, config_schema, default_config,
        publish_status, icon, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'none', ?, ?, ?)
    `, [
      id, userId, 
      skillData.name || '', 
      skillData.display_name || skillData.name || '',
      skillData.description || '', 
      skillData.version || '1.0.0',
      skillData.category || 'general', 
      JSON.stringify(skillData.tags || []),
      skillData.skill_content || '',
      JSON.stringify(skillData.config_schema || {}),
      JSON.stringify(skillData.default_config || {}),
      skillData.icon || '', 
      now, 
      now
    ]);

    return this.getCustomSkill(id);
  }

  /**
   * 获取自建技能详情
   */
  async getCustomSkill(id: string): Promise<CustomSkill | null> {
    const row = await this.db.get('SELECT * FROM custom_skills WHERE id = ?', [id]);
    return row ? this.formatSkill(row as Record<string, unknown>) as CustomSkill : null;
  }

  /**
   * 更新自建技能
   */
  async updateCustomSkill(
    id: string, 
    userId: string, 
    skillData: Partial<CustomSkill>
  ): Promise<CustomSkill | null> {
    const now = Date.now();
    
    await this.db.run(`
      UPDATE custom_skills SET
        name = COALESCE(?, name),
        display_name = COALESCE(?, display_name),
        description = COALESCE(?, description),
        version = COALESCE(?, version),
        category = COALESCE(?, category),
        tags = COALESCE(?, tags),
        skill_content = COALESCE(?, skill_content),
        config_schema = COALESCE(?, config_schema),
        default_config = COALESCE(?, default_config),
        icon = COALESCE(?, icon),
        updated_at = ?
      WHERE id = ? AND user_id = ?
    `, [
      skillData.name || null, 
      skillData.display_name || null, 
      skillData.description || null,
      skillData.version || null, 
      skillData.category || null,
      skillData.tags ? JSON.stringify(skillData.tags) : null,
      skillData.skill_content || null,
      skillData.config_schema ? JSON.stringify(skillData.config_schema) : null,
      skillData.default_config ? JSON.stringify(skillData.default_config) : null,
      skillData.icon || null, 
      now, 
      id, 
      userId
    ]);

    return this.getCustomSkill(id);
  }

  /**
   * 删除自建技能
   */
  async deleteCustomSkill(id: string, userId: string): Promise<boolean> {
    const result = await this.db.run(
      'DELETE FROM custom_skills WHERE id = ? AND user_id = ?',
      [id, userId]
    );
    return result.changes > 0;
  }

  // ==================== 管理功能 ====================

  /**
   * 获取待审核技能
   */
  async getPendingSkills(): Promise<MarketplaceSkill[]> {
    const rows = await this.db.all(
      "SELECT * FROM marketplace_skills WHERE status = 'pending' ORDER BY created_at ASC"
    );
    return rows.map(row => this.formatSkill(row as Record<string, unknown>) as MarketplaceSkill);
  }

  /**
   * 批准技能
   */
  async approveSkill(
    skillId: string, 
    reviewerId: string, 
    note: string = ''
  ): Promise<ApiResponse> {
    const now = Date.now();
    
    await this.db.run(`
      UPDATE marketplace_skills SET
        status = 'approved',
        reviewed_by = ?,
        reviewed_at = ?,
        review_note = ?,
        updated_at = ?
      WHERE id = ?
    `, [reviewerId, now, note, now, skillId]);

    return { success: true };
  }

  /**
   * 拒绝技能
   */
  async rejectSkill(
    skillId: string, 
    reviewerId: string, 
    note: string = ''
  ): Promise<ApiResponse> {
    const now = Date.now();
    
    await this.db.run(`
      UPDATE marketplace_skills SET
        status = 'rejected',
        reviewed_by = ?,
        reviewed_at = ?,
        review_note = ?,
        updated_at = ?
      WHERE id = ?
    `, [reviewerId, now, note, now, skillId]);

    return { success: true };
  }

  // ==================== 工具方法 ====================

  private formatSkill(row: Record<string, unknown>): Skill {
    if (!row) return null as unknown as Skill;
    
    return {
      ...row,
      tags: typeof row.tags === 'string' ? JSON.parse(row.tags as string) : row.tags,
      config_schema: typeof row.config_schema === 'string' 
        ? JSON.parse(row.config_schema as string) 
        : row.config_schema,
      default_config: typeof row.default_config === 'string' 
        ? JSON.parse(row.default_config as string) 
        : row.default_config
    } as Skill;
  }
}
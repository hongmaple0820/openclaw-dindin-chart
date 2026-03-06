/**
 * 角色管理器
 */
const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');

class CharacterManager {
  constructor() {
    const dbPath = path.join(os.homedir(), '.openclaw', 'chat-data', 'messages.db');
    this.db = new Database(dbPath);
  }
  
  /**
   * 加载角色
   */
  loadCharacter(characterId) {
    const stmt = this.db.prepare('SELECT * FROM characters WHERE id = ?');
    const character = stmt.get(characterId);
    
    if (character) {
      // 解析 JSON 字段
      character.personality = character.personality ? JSON.parse(character.personality) : {};
      character.speaking_style = character.speaking_style ? JSON.parse(character.speaking_style) : {};
      character.voice_config = character.voice_config ? JSON.parse(character.voice_config) : {};
      character.reference_images = character.reference_images ? JSON.parse(character.reference_images) : [];
    }
    
    return character;
  }
  
  /**
   * 获取当前角色
   */
  getCurrentCharacter() {
    // 从配置获取当前角色 ID，默认为 xiaolin
    const config = require('../config');
    const characterId = config.character?.currentCharacterId || 'xiaolin';
    return this.loadCharacter(characterId);
  }
  
  /**
   * 获取角色列表
   */
  listCharacters() {
    const stmt = this.db.prepare('SELECT * FROM characters ORDER BY created_at DESC');
    const characters = stmt.all();
    
    return characters.map(char => ({
      ...char,
      personality: char.personality ? JSON.parse(char.personality) : {},
      speaking_style: char.speaking_style ? JSON.parse(char.speaking_style) : {},
      voice_config: char.voice_config ? JSON.parse(char.voice_config) : {}
    }));
  }
  
  /**
   * 创建角色
   */
  createCharacter(data) {
    const {
      id,
      name,
      englishName,
      characterType = 'friend',
      personality = {},
      speakingStyle = {},
      background = '',
      avatarPath = '',
      referenceImages = [],
      voiceConfig = {}
    } = data;
    
    const stmt = this.db.prepare(`
      INSERT INTO characters (
        id, name, english_name, character_type, personality, 
        speaking_style, background, avatar_path, reference_images, voice_config
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      id,
      name,
      englishName,
      characterType,
      JSON.stringify(personality),
      JSON.stringify(speakingStyle),
      background,
      avatarPath,
      JSON.stringify(referenceImages),
      JSON.stringify(voiceConfig)
    );
    
    return this.loadCharacter(id);
  }
  
  /**
   * 更新角色
   */
  updateCharacter(characterId, updates) {
    const fields = [];
    const values = [];
    
    if (updates.name) {
      fields.push('name = ?');
      values.push(updates.name);
    }
    if (updates.personality) {
      fields.push('personality = ?');
      values.push(JSON.stringify(updates.personality));
    }
    if (updates.speakingStyle) {
      fields.push('speaking_style = ?');
      values.push(JSON.stringify(updates.speakingStyle));
    }
    if (updates.voiceConfig) {
      fields.push('voice_config = ?');
      values.push(JSON.stringify(updates.voiceConfig));
    }
    
    fields.push('updated_at = ?');
    values.push(Date.now());
    
    values.push(characterId);
    
    const stmt = this.db.prepare(`
      UPDATE characters SET ${fields.join(', ')} WHERE id = ?
    `);
    
    stmt.run(...values);
    return this.loadCharacter(characterId);
  }
  
  /**
   * 删除角色
   */
  deleteCharacter(characterId) {
    const stmt = this.db.prepare('DELETE FROM characters WHERE id = ?');
    stmt.run(characterId);
  }
}

module.exports = new CharacterManager();

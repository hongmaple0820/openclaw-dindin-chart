/**
 * 角色管理器
 */
import Database from 'better-sqlite3';
import path from 'path';
import os from 'os';

type SqliteDatabase = ReturnType<typeof Database>;

// 类型定义
export interface Personality {
  traits?: string[];
  interests?: string[];
}

export interface SpeakingStyle {
  tone?: string;
  particles?: string[];
  sentenceEndings?: string[];
  personalPronoun?: string;
  emojiFrequency?: number;
  emoji?: string[];
}

export interface VoiceConfig {
  provider?: string;
  voiceId?: string;
  speed?: number;
  pitch?: number;
}

export interface Character {
  id: string;
  name: string;
  english_name?: string;
  character_type?: string;
  personality: Personality;
  speaking_style: SpeakingStyle;
  background?: string;
  avatar_path?: string;
  reference_images: string[];
  voice_config: VoiceConfig;
  created_at?: number;
  updated_at?: number;
}

export interface CreateCharacterData {
  id: string;
  name: string;
  englishName?: string;
  characterType?: string;
  personality?: Personality;
  speakingStyle?: SpeakingStyle;
  background?: string;
  avatarPath?: string;
  referenceImages?: string[];
  voiceConfig?: VoiceConfig;
}

export interface UpdateCharacterData {
  name?: string;
  personality?: Personality;
  speakingStyle?: SpeakingStyle;
  voiceConfig?: VoiceConfig;
}

class CharacterManagerClass {
  private db: SqliteDatabase;

  constructor() {
    const dbPath = path.join(os.homedir(), '.openclaw', 'chat-data', 'messages.db');
    this.db = Database(dbPath);
  }
  
  /**
   * 加载角色
   */
  loadCharacter(characterId: string): Character | undefined {
    const stmt = this.db.prepare('SELECT * FROM characters WHERE id = ?');
    const character = stmt.get(characterId) as Character | undefined;
    
    if (character) {
      // 解析 JSON 字段
      character.personality = character.personality ? JSON.parse(character.personality as unknown as string) : {};
      character.speaking_style = character.speaking_style ? JSON.parse(character.speaking_style as unknown as string) : {};
      character.voice_config = character.voice_config ? JSON.parse(character.voice_config as unknown as string) : {};
      character.reference_images = character.reference_images ? JSON.parse(character.reference_images as unknown as string) : [];
    }
    
    return character;
  }
  
  /**
   * 获取当前角色
   */
  getCurrentCharacter(): Character | undefined {
    // 从配置获取当前角色 ID，默认为 xiaolin
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const config = require('../config');
    const characterId = config.character?.currentCharacterId || 'xiaolin';
    return this.loadCharacter(characterId);
  }
  
  /**
   * 获取角色列表
   */
  listCharacters(): Character[] {
    const stmt = this.db.prepare('SELECT * FROM characters ORDER BY created_at DESC');
    const characters = stmt.all() as Character[];
    
    return characters.map(char => ({
      ...char,
      personality: char.personality ? JSON.parse(char.personality as unknown as string) : {},
      speaking_style: char.speaking_style ? JSON.parse(char.speaking_style as unknown as string) : {},
      voice_config: char.voice_config ? JSON.parse(char.voice_config as unknown as string) : {}
    }));
  }
  
  /**
   * 创建角色
   */
  createCharacter(data: CreateCharacterData): Character {
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
    
    return this.loadCharacter(id)!;
  }
  
  /**
   * 更新角色
   */
  updateCharacter(characterId: string, updates: UpdateCharacterData): Character | undefined {
    const fields: string[] = [];
    const values: unknown[] = [];
    
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
  deleteCharacter(characterId: string): void {
    const stmt = this.db.prepare('DELETE FROM characters WHERE id = ?');
    stmt.run(characterId);
  }
}

const CharacterManager = new CharacterManagerClass();
export default CharacterManager;
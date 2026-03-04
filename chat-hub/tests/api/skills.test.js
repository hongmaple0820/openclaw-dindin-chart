/**
 * Skills API 测试
 * 
 * 测试端点：
 * - GET    /api/skills              获取技能列表
 * - GET    /api/skills/:id          获取技能详情
 * - POST   /api/skills              注册技能
 * - PUT    /api/skills/:id          更新技能
 * - DELETE /api/skills/:id          删除技能
 */

const request = require('supertest');
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getTestDb, TEST_PORT } = require('../setup');

// 模拟 Skills 模块
const skillsRouter = require('../../src/routes/skills');

// 创建测试应用
function createTestApp() {
  const app = express();
  app.use(express.json());
  
  // 模拟数据库
  app.locals.db = getTestDb();
  
  // 挂载路由
  app.use('/api/skills', skillsRouter.router);
  
  return app;
}

describe('Skills API', () => {
  let app;
  let testDb;
  
  beforeAll(() => {
    app = createTestApp();
    testDb = getTestDb();
  });
  
  // 模拟 SkillsManager
  const mockSkillsManager = {
    registry: {
      list: jest.fn(),
      get: jest.fn(),
      register: jest.fn(),
      unregister: jest.fn(),
      getUserSkills: jest.fn(),
      bindUserSkill: jest.fn(),
      unbindUserSkill: jest.fn(),
      recordUsage: jest.fn(),
      db: null
    },
    executor: {
      execute: jest.fn(),
      getStats: jest.fn()
    },
    mcporterBridge: {
      getServer: jest.fn(),
      getAllServers: jest.fn(),
      addServer: jest.fn(),
      removeServer: jest.fn(),
      isToolAvailable: jest.fn(),
      call: jest.fn(),
      auth: jest.fn()
    }
  };
  
  beforeEach(() => {
    // 设置 mock registry db
    mockSkillsManager.registry.db = testDb;
    skillsRouter.setSkillsManager(mockSkillsManager);
    
    // 重置 mock
    jest.clearAllMocks();
  });
  
  describe('GET /api/skills', () => {
    it('应该返回技能列表', async () => {
      const mockSkills = [
        { id: 'skill-1', name: 'test-skill', description: 'Test skill' },
        { id: 'skill-2', name: 'another-skill', description: 'Another skill' }
      ];
      mockSkillsManager.registry.list.mockResolvedValue(mockSkills);
      
      const res = await request(app)
        .get('/api/skills')
        .expect(200);
      
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2);
      expect(mockSkillsManager.registry.list).toHaveBeenCalled();
    });
    
    it('应该支持分页参数', async () => {
      mockSkillsManager.registry.list.mockResolvedValue(Array(20).fill({}));
      
      const res = await request(app)
        .get('/api/skills?limit=10&offset=5')
        .expect(200);
      
      expect(res.body.limit).toBe(10);
      expect(res.body.offset).toBe(5);
    });
    
    it('应该支持过滤参数', async () => {
      mockSkillsManager.registry.list.mockResolvedValue([]);
      
      await request(app)
        .get('/api/skills?category=ai&enabled=true&search=test')
        .expect(200);
      
      expect(mockSkillsManager.registry.list).toHaveBeenCalledWith({
        category: 'ai',
        enabled: true,
        search: 'test'
      });
    });
    
    it('应该处理错误情况', async () => {
      mockSkillsManager.registry.list.mockRejectedValue(new Error('Database error'));
      
      const res = await request(app)
        .get('/api/skills')
        .expect(500);
      
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Database error');
    });
  });
  
  describe('GET /api/skills/:id', () => {
    it('应该返回技能详情', async () => {
      const mockSkill = { id: 'skill-1', name: 'test-skill', description: 'Test' };
      mockSkillsManager.registry.get.mockResolvedValue(mockSkill);
      
      const res = await request(app)
        .get('/api/skills/skill-1')
        .expect(200);
      
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual(mockSkill);
    });
    
    it('应该返回404当技能不存在', async () => {
      mockSkillsManager.registry.get.mockResolvedValue(null);
      
      const res = await request(app)
        .get('/api/skills/non-existent')
        .expect(404);
      
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Skill not found');
    });
  });
  
  describe('POST /api/skills', () => {
    it('应该成功注册技能', async () => {
      const skillData = {
        id: 'new-skill',
        name: 'New Skill',
        description: 'A new skill',
        category: 'general'
      };
      
      mockSkillsManager.registry.register.mockResolvedValue({
        ...skillData,
        created_at: Date.now()
      });
      
      const res = await request(app)
        .post('/api/skills')
        .send(skillData)
        .expect(201);
      
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe('new-skill');
    });
    
    it('应该拒绝缺少必填字段的请求', async () => {
      const res = await request(app)
        .post('/api/skills')
        .send({ description: 'Missing name and id' })
        .expect(400);
      
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('id and name are required');
    });
    
    it('应该处理注册失败', async () => {
      mockSkillsManager.registry.register.mockRejectedValue(new Error('Skill already exists'));
      
      const res = await request(app)
        .post('/api/skills')
        .send({ id: 'existing', name: 'Existing' })
        .expect(500);
      
      expect(res.body.error).toBe('Skill already exists');
    });
  });
  
  describe('PUT /api/skills/:id', () => {
    it('应该成功更新技能', async () => {
      const existingSkill = {
        id: 'skill-1',
        name: 'Old Name',
        description: 'Old desc'
      };
      
      mockSkillsManager.registry.get
        .mockResolvedValueOnce(existingSkill) // 第一次检查存在
        .mockResolvedValueOnce({ ...existingSkill, name: 'New Name' }); // 返回更新后的
      
      const res = await request(app)
        .put('/api/skills/skill-1')
        .send({ name: 'New Name' })
        .expect(200);
      
      expect(res.body.success).toBe(true);
    });
    
    it('应该拒绝更新不存在的技能', async () => {
      mockSkillsManager.registry.get.mockResolvedValue(null);
      
      const res = await request(app)
        .put('/api/skills/non-existent')
        .send({ name: 'New Name' })
        .expect(404);
      
      expect(res.body.error).toBe('Skill not found');
    });
  });
  
  describe('DELETE /api/skills/:id', () => {
    it('应该成功删除技能', async () => {
      mockSkillsManager.registry.unregister.mockResolvedValue(true);
      
      const res = await request(app)
        .delete('/api/skills/skill-1')
        .expect(200);
      
      expect(res.body.success).toBe(true);
      expect(res.body.data.deleted).toBe(true);
    });
    
    it('应该返回404当技能不存在', async () => {
      mockSkillsManager.registry.unregister.mockResolvedValue(null);
      
      const res = await request(app)
        .delete('/api/skills/non-existent')
        .expect(404);
      
      expect(res.body.error).toBe('Skill not found');
    });
  });
  
  describe('用户技能绑定 API', () => {
    describe('GET /api/skills/user/:userId', () => {
      it('应该返回用户绑定的技能', async () => {
        const userSkills = [
          { skill_id: 'skill-1', config: {} },
          { skill_id: 'skill-2', config: {} }
        ];
        mockSkillsManager.registry.getUserSkills.mockResolvedValue(userSkills);
        
        const res = await request(app)
          .get('/api/skills/user/user-1')
          .expect(200);
        
        expect(res.body.success).toBe(true);
        expect(res.body.data).toHaveLength(2);
      });
    });
    
    describe('POST /api/skills/user/:userId', () => {
      it('应该成功绑定用户技能', async () => {
        mockSkillsManager.registry.get.mockResolvedValue({ id: 'skill-1' });
        mockSkillsManager.registry.bindUserSkill.mockResolvedValue({});
        mockSkillsManager.registry.getUserSkill.mockResolvedValue({
          user_id: 'user-1',
          skill_id: 'skill-1'
        });
        
        const res = await request(app)
          .post('/api/skills/user/user-1')
          .send({ skillId: 'skill-1' })
          .expect(201);
        
        expect(res.body.success).toBe(true);
      });
      
      it('应该拒绝绑定不存在的技能', async () => {
        mockSkillsManager.registry.get.mockResolvedValue(null);
        
        const res = await request(app)
          .post('/api/skills/user/user-1')
          .send({ skillId: 'non-existent' })
          .expect(404);
        
        expect(res.body.error).toBe('Skill not found');
      });
    });
    
    describe('DELETE /api/skills/user/:userId/:skillId', () => {
      it('应该成功解绑用户技能', async () => {
        mockSkillsManager.registry.unbindUserSkill.mockResolvedValue(true);
        
        const res = await request(app)
          .delete('/api/skills/user/user-1/skill-1')
          .expect(200);
        
        expect(res.body.success).toBe(true);
      });
    });
  });
  
  describe('技能执行 API', () => {
    describe('POST /api/skills/execute', () => {
      it('应该成功执行技能', async () => {
        mockSkillsManager.executor.execute.mockResolvedValue({ result: 'success' });
        mockSkillsManager.registry.recordUsage.mockResolvedValue();
        
        const res = await request(app)
          .post('/api/skills/execute')
          .send({ skillId: 'skill-1', params: {} })
          .expect(200);
        
        expect(res.body.success).toBe(true);
        expect(res.body.data.result).toBe('success');
      });
      
      it('应该拒绝缺少技能标识的请求', async () => {
        const res = await request(app)
          .post('/api/skills/execute')
          .send({ params: {} })
          .expect(400);
        
        expect(res.body.error).toBe('skillId or skillName is required');
      });
    });
  });
  
  describe('MCP 服务器 API', () => {
    describe('GET /api/skills/mcp', () => {
      it('应该返回MCP服务器列表', async () => {
        mockSkillsManager.mcporterBridge.getAllServers.mockReturnValue([
          { name: 'server-1', type: 'stdio' }
        ]);
        
        const res = await request(app)
          .get('/api/skills/mcp')
          .expect(200);
        
        expect(res.body.success).toBe(true);
        expect(res.body.data).toHaveLength(1);
      });
    });
    
    describe('POST /api/skills/mcp', () => {
      it('应该成功添加MCP服务器', async () => {
        mockSkillsManager.mcporterBridge.addServer.mockResolvedValue({
          name: 'new-server',
          type: 'stdio'
        });
        
        const res = await request(app)
          .post('/api/skills/mcp')
          .send({ name: 'new-server', type: 'stdio' })
          .expect(201);
        
        expect(res.body.success).toBe(true);
      });
      
      it('应该拒绝缺少名称的请求', async () => {
        const res = await request(app)
          .post('/api/skills/mcp')
          .send({ type: 'stdio' })
          .expect(400);
        
        expect(res.body.error).toBe('name is required');
      });
      
      it('应该验证服务器类型', async () => {
        const res = await request(app)
          .post('/api/skills/mcp')
          .send({ name: 'test', type: 'invalid' })
          .expect(400);
        
        expect(res.body.error).toContain('type must be one of');
      });
    });
    
    describe('POST /api/skills/mcp/call', () => {
      it('应该成功调用MCP工具', async () => {
        mockSkillsManager.mcporterBridge.isToolAvailable.mockReturnValue(true);
        mockSkillsManager.mcporterBridge.call.mockResolvedValue({ result: 'ok' });
        
        const res = await request(app)
          .post('/api/skills/mcp/call')
          .send({ selector: 'server.tool', args: {} })
          .expect(200);
        
        expect(res.body.success).toBe(true);
      });
      
      it('应该拒绝不可用的工具', async () => {
        mockSkillsManager.mcporterBridge.isToolAvailable.mockReturnValue(false);
        
        const res = await request(app)
          .post('/api/skills/mcp/call')
          .send({ selector: 'server.tool' })
          .expect(404);
        
        expect(res.body.error).toContain('MCP tool not available');
      });
    });
  });
  
  describe('错误处理', () => {
    it('应该处理未初始化的管理器', async () => {
      skillsRouter.setSkillsManager(null);
      
      const res = await request(app)
        .get('/api/skills')
        .expect(500);
      
      expect(res.body.error).toBe('Skills manager not initialized');
    });
  });
});

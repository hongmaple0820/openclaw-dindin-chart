/**
 * Capability Router - 能力路由
 * 
 * 功能：
 * - 根据能力选择 Agent
 * - 负载均衡
 * - 故障转移
 */

const EventEmitter = require('events');

class CapabilityRouter extends EventEmitter {
  constructor(registry) {
    super();
    this.registry = registry;
    this.agentStatus = new Map(); // agentId -> { status, load, lastCheck }
    this.routingHistory = []; // 最近的路由历史
    this.maxHistory = 100;
    
    // 负载均衡策略
    this.strategies = {
      'round-robin': this.roundRobin.bind(this),
      'least-load': this.leastLoad.bind(this),
      'random': this.randomSelect.bind(this),
      'priority': this.prioritySelect.bind(this)
    };
    
    this.defaultStrategy = 'least-load';
  }

  /**
   * 根据能力路由到合适的 Agent
   */
  async route(capability, options = {}) {
    const {
      strategy = this.defaultStrategy,
      excludeAgents = [],
      preferAgent = null,
      userId = null,
      requirePublic = false
    } = options;

    // 查找具有指定能力的 Agents
    let agents = this.registry.findByCapability(capability);

    // 过滤
    agents = agents.filter(agent => {
      // 排除指定的 agents
      if (excludeAgents.includes(agent.id)) return false;

      // 公开性要求
      if (requirePublic && !agent.isPublic) return false;

      // 权限检查（私有 Agent）
      if (!agent.isPublic && userId && agent.ownerId !== userId) return false;

      // 状态检查
      if (agent.status === 'offline' || agent.status === 'error') return false;

      return true;
    });

    if (agents.length === 0) {
      return {
        success: false,
        error: 'no_available_agent',
        message: `No available agent with capability: ${capability}`
      };
    }

    // 优先选择指定的 Agent
    if (preferAgent) {
      const preferred = agents.find(a => a.id === preferAgent);
      if (preferred && this.isAvailable(preferred.id)) {
        this.recordRouting(preferred.id, capability, strategy);
        return {
          success: true,
          agent: preferred,
          strategy: 'preferred'
        };
      }
    }

    // 应用负载均衡策略
    const selectStrategy = this.strategies[strategy] || this.strategies[this.defaultStrategy];
    const selectedAgent = selectStrategy(agents);

    if (!selectedAgent) {
      return {
        success: false,
        error: 'no_available_agent',
        message: 'All agents are busy or unavailable'
      };
    }

    this.recordRouting(selectedAgent.id, capability, strategy);

    return {
      success: true,
      agent: selectedAgent,
      strategy
    };
  }

  /**
   * 轮询策略
   */
  roundRobin(agents) {
    const available = agents.filter(a => this.isAvailable(a.id));
    if (available.length === 0) return null;

    // 使用历史记录找到上一个选择的 agent
    const lastRouting = this.routingHistory
      .filter(r => available.some(a => a.id === r.agentId))
      .pop();

    if (!lastRouting) {
      return available[0];
    }

    const lastIndex = available.findIndex(a => a.id === lastRouting.agentId);
    const nextIndex = (lastIndex + 1) % available.length;
    return available[nextIndex];
  }

  /**
   * 最小负载策略
   */
  leastLoad(agents) {
    const available = agents.filter(a => this.isAvailable(a.id));
    if (available.length === 0) return null;

    // 按负载排序
    available.sort((a, b) => {
      const loadA = this.getAgentLoad(a.id);
      const loadB = this.getAgentLoad(b.id);
      return loadA - loadB;
    });

    return available[0];
  }

  /**
   * 随机策略
   */
  randomSelect(agents) {
    const available = agents.filter(a => this.isAvailable(a.id));
    if (available.length === 0) return null;
    
    const index = Math.floor(Math.random() * available.length);
    return available[index];
  }

  /**
   * 优先级策略
   */
  prioritySelect(agents) {
    const available = agents.filter(a => this.isAvailable(a.id));
    if (available.length === 0) return null;

    // 按优先级排序（system > user-added > client）
    const priorityOrder = { 'system': 0, 'user-added': 1, 'client': 2 };
    available.sort((a, b) => {
      const pA = priorityOrder[a.type] ?? 3;
      const pB = priorityOrder[b.type] ?? 3;
      return pA - pB;
    });

    return available[0];
  }

  /**
   * 检查 Agent 是否可用
   */
  isAvailable(agentId) {
    const status = this.agentStatus.get(agentId);
    if (!status) return true;

    // 检查状态
    if (status.status === 'offline' || status.status === 'error') return false;

    // 检查负载
    if (status.load >= 100) return false;

    // 检查最后检查时间（超过 30 秒认为可能不可用）
    if (Date.now() - status.lastCheck > 30000) {
      // 触发健康检查
      this.checkAgentHealth(agentId);
    }

    return true;
  }

  /**
   * 获取 Agent 负载
   */
  getAgentLoad(agentId) {
    const status = this.agentStatus.get(agentId);
    return status?.load ?? 0;
  }

  /**
   * 更新 Agent 状态
   */
  updateAgentStatus(agentId, status, load = null) {
    const current = this.agentStatus.get(agentId) || {};
    
    this.agentStatus.set(agentId, {
      status: status ?? current.status ?? 'online',
      load: load ?? current.load ?? 0,
      lastCheck: Date.now(),
      errorCount: status === 'error' ? (current.errorCount || 0) + 1 : 0
    });

    this.emit('status-update', { agentId, status: this.agentStatus.get(agentId) });
  }

  /**
   * 增加负载
   */
  incrementLoad(agentId, amount = 1) {
    const current = this.agentStatus.get(agentId) || { load: 0, status: 'online' };
    this.agentStatus.set(agentId, {
      ...current,
      load: Math.max(0, current.load + amount),
      lastCheck: Date.now()
    });
  }

  /**
   * 减少负载
   */
  decrementLoad(agentId, amount = 1) {
    this.incrementLoad(agentId, -amount);
  }

  /**
   * 记录路由历史
   */
  recordRouting(agentId, capability, strategy) {
    this.routingHistory.push({
      agentId,
      capability,
      strategy,
      timestamp: Date.now()
    });

    // 限制历史长度
    if (this.routingHistory.length > this.maxHistory) {
      this.routingHistory = this.routingHistory.slice(-this.maxHistory);
    }

    // 增加负载
    this.incrementLoad(agentId);
  }

  /**
   * 检查 Agent 健康
   */
  async checkAgentHealth(agentId) {
    const agent = this.registry.getAgent(agentId);
    if (!agent) {
      this.updateAgentStatus(agentId, 'offline', 100);
      return false;
    }

    try {
      // 使用 OpenAI 适配器检查健康
      const OpenAIAdapter = require('./openai-adapter');
      const adapter = new OpenAIAdapter(agent);
      const health = await adapter.healthCheck();

      if (health.healthy) {
        this.updateAgentStatus(agentId, 'online', 0);
        return true;
      } else {
        this.updateAgentStatus(agentId, 'error', 100);
        return false;
      }
    } catch (error) {
      this.updateAgentStatus(agentId, 'error', 100);
      return false;
    }
  }

  /**
   * 故障转移
   */
  async failover(agentId, capability, options = {}) {
    const { maxRetries = 3, retryDelay = 1000 } = options;

    // 标记当前 agent 为错误状态
    this.updateAgentStatus(agentId, 'error', 100);

    // 尝试找到替代 agent
    for (let i = 0; i < maxRetries; i++) {
      const result = await this.route(capability, {
        ...options,
        excludeAgents: [...(options.excludeAgents || []), agentId]
      });

      if (result.success) {
        this.emit('failover', {
          fromAgentId: agentId,
          toAgentId: result.agent.id,
          capability,
          attempt: i + 1
        });
        return result;
      }

      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }

    return {
      success: false,
      error: 'failover_failed',
      message: 'No fallback agent available after retries'
    };
  }

  /**
   * 获取路由统计
   */
  getStats() {
    const stats = {
      totalRoutings: this.routingHistory.length,
      agentsByStatus: {
        online: 0,
        offline: 0,
        busy: 0,
        error: 0
      },
      capabilityUsage: {},
      strategyUsage: {},
      averageLoad: 0
    };

    // 统计 agent 状态
    for (const [agentId, status] of this.agentStatus) {
      const s = status.status || 'online';
      stats.agentsByStatus[s] = (stats.agentsByStatus[s] || 0) + 1;
    }

    // 统计路由历史
    for (const routing of this.routingHistory) {
      stats.capabilityUsage[routing.capability] = 
        (stats.capabilityUsage[routing.capability] || 0) + 1;
      stats.strategyUsage[routing.strategy] = 
        (stats.strategyUsage[routing.strategy] || 0) + 1;
    }

    // 计算平均负载
    let totalLoad = 0;
    let count = 0;
    for (const status of this.agentStatus.values()) {
      totalLoad += status.load || 0;
      count++;
    }
    stats.averageLoad = count > 0 ? totalLoad / count : 0;

    return stats;
  }

  /**
   * 清理过期状态
   */
  cleanup(maxAge = 3600000) { // 默认 1 小时
    const now = Date.now();
    const expired = [];

    for (const [agentId, status] of this.agentStatus) {
      if (now - status.lastCheck > maxAge) {
        expired.push(agentId);
      }
    }

    for (const agentId of expired) {
      this.agentStatus.delete(agentId);
    }

    return expired.length;
  }
}

module.exports = CapabilityRouter;
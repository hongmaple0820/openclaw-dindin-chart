/**
 * Capability Router - 能力路由
 * 
 * 功能：
 * - 根据能力选择 Agent
 * - 负载均衡
 * - 故障转移
 */

import EventEmitter from 'events';
import type AgentRegistry from './registry';

interface Agent {
  id: string;
  nickname: string;
  type: string;
  isPublic: boolean;
  status: string;
}

interface AgentStatus {
  status: string;
  load: number;
  lastCheck: number;
  errorCount?: number;
}

interface RouteOptions {
  strategy?: string;
  excludeAgents?: string[];
  preferAgent?: string | null;
  userId?: string | null;
  requirePublic?: boolean;
}

interface RouteResult {
  success: boolean;
  agent?: Agent;
  strategy?: string;
  error?: string;
  message?: string;
}

interface RoutingHistory {
  agentId: string;
  capability: string;
  strategy: string;
  timestamp: number;
}

class CapabilityRouter extends EventEmitter {
  private registry: InstanceType<typeof AgentRegistry>;
  private agentStatus: Map<string, AgentStatus> = new Map();
  private routingHistory: RoutingHistory[] = [];
  private maxHistory: number = 100;
  
  private strategies: Record<string, (agents: Agent[]) => Agent | null>;
  private defaultStrategy: string = 'least-load';

  constructor(registry: InstanceType<typeof AgentRegistry>) {
    super();
    this.registry = registry;
    
    this.strategies = {
      'round-robin': this.roundRobin.bind(this),
      'least-load': this.leastLoad.bind(this),
      'random': this.randomSelect.bind(this),
      'priority': this.prioritySelect.bind(this)
    };
  }

  /**
   * 根据能力路由到合适的 Agent
   */
  async route(capability: string, options: RouteOptions = {}): Promise<RouteResult> {
    const {
      strategy = this.defaultStrategy,
      excludeAgents = [],
      preferAgent = null,
      userId = null,
      requirePublic = false
    } = options;

    let agents = this.registry.findByCapability(capability);

    agents = agents.filter(agent => {
      if (excludeAgents.includes(agent.id)) return false;
      if (requirePublic && !agent.isPublic) return false;
      if (!agent.isPublic && userId && agent.ownerId !== userId) return false;
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
  private roundRobin(agents: Agent[]): Agent | null {
    const available = agents.filter(a => this.isAvailable(a.id));
    if (available.length === 0) return null;

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
  private leastLoad(agents: Agent[]): Agent | null {
    const available = agents.filter(a => this.isAvailable(a.id));
    if (available.length === 0) return null;

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
  private randomSelect(agents: Agent[]): Agent | null {
    const available = agents.filter(a => this.isAvailable(a.id));
    if (available.length === 0) return null;
    
    const index = Math.floor(Math.random() * available.length);
    return available[index];
  }

  /**
   * 优先级策略
   */
  private prioritySelect(agents: Agent[]): Agent | null {
    const available = agents.filter(a => this.isAvailable(a.id));
    if (available.length === 0) return null;

    const priorityOrder: Record<string, number> = { 'system': 0, 'user-added': 1, 'client': 2 };
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
  isAvailable(agentId: string): boolean {
    const status = this.agentStatus.get(agentId);
    if (!status) return true;

    if (status.status === 'offline' || status.status === 'error') return false;
    if (status.load >= 100) return false;

    if (Date.now() - status.lastCheck > 30000) {
      this.checkAgentHealth(agentId);
    }

    return true;
  }

  /**
   * 获取 Agent 负载
   */
  getAgentLoad(agentId: string): number {
    const status = this.agentStatus.get(agentId);
    return status?.load ?? 0;
  }

  /**
   * 更新 Agent 状态
   */
  updateAgentStatus(agentId: string, status: string, load: number | null = null): void {
    const current = this.agentStatus.get(agentId) || { load: 0, status: 'online' };
    
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
  incrementLoad(agentId: string, amount: number = 1): void {
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
  decrementLoad(agentId: string, amount: number = 1): void {
    this.incrementLoad(agentId, -amount);
  }

  /**
   * 记录路由历史
   */
  private recordRouting(agentId: string, capability: string, strategy: string): void {
    this.routingHistory.push({
      agentId,
      capability,
      strategy,
      timestamp: Date.now()
    });

    if (this.routingHistory.length > this.maxHistory) {
      this.routingHistory = this.routingHistory.slice(-this.maxHistory);
    }

    this.incrementLoad(agentId);
  }

  /**
   * 检查 Agent 健康
   */
  async checkAgentHealth(agentId: string): Promise<boolean> {
    const agent = this.registry.getAgent(agentId);
    if (!agent) {
      this.updateAgentStatus(agentId, 'offline', 100);
      return false;
    }

    try {
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
  async failover(agentId: string, capability: string, options: RouteOptions & { maxRetries?: number; retryDelay?: number } = {}): Promise<RouteResult> {
    const { maxRetries = 3, retryDelay = 1000, ...routeOptions } = options;

    this.updateAgentStatus(agentId, 'error', 100);

    for (let i = 0; i < maxRetries; i++) {
      const result = await this.route(capability, {
        ...routeOptions,
        excludeAgents: [...(routeOptions.excludeAgents || []), agentId]
      });

      if (result.success) {
        this.emit('failover', {
          fromAgentId: agentId,
          toAgentId: result.agent!.id,
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
  getStats(): {
    totalRoutings: number;
    agentsByStatus: Record<string, number>;
    capabilityUsage: Record<string, number>;
    strategyUsage: Record<string, number>;
    averageLoad: number;
  } {
    const stats = {
      totalRoutings: this.routingHistory.length,
      agentsByStatus: {
        online: 0,
        offline: 0,
        busy: 0,
        error: 0
      },
      capabilityUsage: {} as Record<string, number>,
      strategyUsage: {} as Record<string, number>,
      averageLoad: 0
    };

    for (const [, status] of this.agentStatus) {
      const s = status.status || 'online';
      stats.agentsByStatus[s] = (stats.agentsByStatus[s] || 0) + 1;
    }

    for (const routing of this.routingHistory) {
      stats.capabilityUsage[routing.capability] = 
        (stats.capabilityUsage[routing.capability] || 0) + 1;
      stats.strategyUsage[routing.strategy] = 
        (stats.strategyUsage[routing.strategy] || 0) + 1;
    }

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
  cleanup(maxAge: number = 3600000): number {
    const now = Date.now();
    const expired: string[] = [];

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

export = CapabilityRouter;
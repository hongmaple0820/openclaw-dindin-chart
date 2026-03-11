/**
 * Skills 状态管理
 * @author 小琳
 * @date 2026-03-04
 */
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { skillApi } from '@/api/skills';
import type { Skill, ApiResponse } from '@/types';

interface SkillWithExtras extends Skill {
  type?: 'built-in' | 'my' | 'market';
  category?: string;
  installed?: boolean;
  installedAt?: string;
}

interface MCPServer {
  id: string;
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  enabled: boolean;
}

export const useSkillStore = defineStore('skills', () => {
  const skills = ref<SkillWithExtras[]>([]);
  const currentSkill = ref<SkillWithExtras | null>(null);
  const mcpServers = ref<MCPServer[]>([]);
  const categories = ref<string[]>([]);
  const loading = ref(false);
  const detailLoading = ref(false);
  const currentTab = ref<'built-in' | 'my' | 'market'>('built-in');
  const searchQuery = ref('');
  const categoryFilter = ref('');

  const skillCount = computed(() => skills.value.length);

  const skillsByCategory = computed(() => {
    const groups: Record<string, SkillWithExtras[]> = {};
    skills.value.forEach(skill => {
      const category = skill.category || '未分类';
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(skill);
    });
    return groups;
  });

  const builtInSkills = computed(() => 
    skills.value.filter(s => s.type === 'built-in')
  );

  const mySkills = computed(() => 
    skills.value.filter(s => s.installed)
  );

  const marketSkills = computed(() => 
    skills.value.filter(s => s.type === 'market')
  );

  async function fetchSkills(params: Record<string, unknown> = {}): Promise<ApiResponse> {
    loading.value = true;
    try {
      const res = await skillApi.getList({
        type: currentTab.value,
        q: searchQuery.value,
        category: categoryFilter.value,
        ...params
      });
      if (res.success && res.skills) {
        skills.value = res.skills as SkillWithExtras[];
      }
      return res;
    } catch (error) {
      console.error('获取技能列表失败:', error);
      return { success: false, error: (error as Error).message };
    } finally {
      loading.value = false;
    }
  }

  async function fetchSkillDetail(skillId: string): Promise<ApiResponse> {
    detailLoading.value = true;
    try {
      const res = await skillApi.getDetail(skillId);
      if (res.success && res.skill) {
        currentSkill.value = res.skill as SkillWithExtras;
      }
      return res;
    } catch (error) {
      console.error('获取技能详情失败:', error);
      return { success: false, error: (error as Error).message };
    } finally {
      detailLoading.value = false;
    }
  }

  async function installSkill(skillId: string, options: Record<string, unknown> = {}): Promise<ApiResponse> {
    try {
      const res = await skillApi.install(skillId, options);
      if (res.success) {
        const skill = skills.value.find(s => s.id === skillId);
        if (skill) {
          skill.installed = true;
          skill.installedAt = new Date().toISOString();
        }
      }
      return res;
    } catch (error) {
      console.error('安装技能失败:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  async function uninstallSkill(skillId: string): Promise<ApiResponse> {
    try {
      const res = await skillApi.uninstall(skillId);
      if (res.success) {
        const skill = skills.value.find(s => s.id === skillId);
        if (skill) {
          skill.installed = false;
          skill.installedAt = undefined;
        }
        if (currentSkill.value?.id === skillId) {
          currentSkill.value = null;
        }
      }
      return res;
    } catch (error) {
      console.error('卸载技能失败:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  async function updateSkillConfig(skillId: string, config: Record<string, unknown>): Promise<ApiResponse> {
    try {
      const res = await skillApi.updateConfig(skillId, config);
      if (res.success) {
        const skill = skills.value.find(s => s.id === skillId);
        if (skill && skill.config) {
          skill.config = { ...skill.config, ...config };
        }
        if (currentSkill.value?.id === skillId && currentSkill.value.config) {
          currentSkill.value.config = { ...currentSkill.value.config, ...config };
        }
      }
      return res;
    } catch (error) {
      console.error('更新技能配置失败:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  async function toggleSkillEnabled(skillId: string, enabled: boolean): Promise<ApiResponse> {
    try {
      const res = await skillApi.toggleEnabled(skillId, enabled);
      if (res.success) {
        const skill = skills.value.find(s => s.id === skillId);
        if (skill) {
          skill.enabled = enabled;
        }
        if (currentSkill.value?.id === skillId) {
          currentSkill.value.enabled = enabled;
        }
      }
      return res;
    } catch (error) {
      console.error('切换技能状态失败:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  async function testSkillCall(skillId: string, params: Record<string, unknown> = {}): Promise<ApiResponse> {
    try {
      const res = await skillApi.testCall(skillId, params);
      return res;
    } catch (error) {
      console.error('测试技能调用失败:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  async function fetchMCPServers(): Promise<ApiResponse> {
    try {
      const res = await skillApi.getMCPServers();
      if (res.success && res.servers) {
        mcpServers.value = res.servers as MCPServer[];
      }
      return res;
    } catch (error) {
      console.error('获取 MCP 服务器列表失败:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  async function addMCPServer(server: Partial<MCPServer>): Promise<ApiResponse> {
    try {
      const res = await skillApi.addMCPServer(server);
      if (res.success && res.server) {
        mcpServers.value.push(res.server as MCPServer);
      }
      return res;
    } catch (error) {
      console.error('添加 MCP 服务器失败:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  async function updateMCPServer(serverId: string, server: Partial<MCPServer>): Promise<ApiResponse> {
    try {
      const res = await skillApi.updateMCPServer(serverId, server);
      if (res.success && res.server) {
        const index = mcpServers.value.findIndex(s => s.id === serverId);
        if (index !== -1) {
          mcpServers.value[index] = res.server as MCPServer;
        }
      }
      return res;
    } catch (error) {
      console.error('更新 MCP 服务器失败:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  async function deleteMCPServer(serverId: string): Promise<ApiResponse> {
    try {
      const res = await skillApi.deleteMCPServer(serverId);
      if (res.success) {
        const index = mcpServers.value.findIndex(s => s.id === serverId);
        if (index !== -1) {
          mcpServers.value.splice(index, 1);
        }
      }
      return res;
    } catch (error) {
      console.error('删除 MCP 服务器失败:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  async function fetchCategories(): Promise<ApiResponse> {
    try {
      const res = await skillApi.getCategories();
      if (res.success && res.categories) {
        categories.value = res.categories as string[];
      }
      return res;
    } catch (error) {
      console.error('获取分类列表失败:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  function selectSkill(skill: SkillWithExtras): void {
    currentSkill.value = skill;
  }

  function clearSelection(): void {
    currentSkill.value = null;
  }

  function setCurrentTab(tab: 'built-in' | 'my' | 'market'): void {
    currentTab.value = tab;
  }

  function setSearchQuery(query: string): void {
    searchQuery.value = query;
  }

  function setCategoryFilter(category: string): void {
    categoryFilter.value = category;
  }

  return {
    skills,
    currentSkill,
    mcpServers,
    categories,
    loading,
    detailLoading,
    currentTab,
    searchQuery,
    categoryFilter,
    skillCount,
    skillsByCategory,
    builtInSkills,
    mySkills,
    marketSkills,
    fetchSkills,
    fetchSkillDetail,
    installSkill,
    uninstallSkill,
    updateSkillConfig,
    toggleSkillEnabled,
    testSkillCall,
    fetchMCPServers,
    addMCPServer,
    updateMCPServer,
    deleteMCPServer,
    fetchCategories,
    selectSkill,
    clearSelection,
    setCurrentTab,
    setSearchQuery,
    setCategoryFilter
  };
});
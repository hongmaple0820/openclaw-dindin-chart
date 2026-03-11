/**
 * Skills 状态管理
 * @author 小琳
 * @date 2026-03-04
 */
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { skillApi } from '@/api/skills';

export const useSkillStore = defineStore('skills', () => {
  // 状态
  const skills = ref([]);
  const currentSkill = ref(null);
  const mcpServers = ref([]);
  const categories = ref([]);
  const loading = ref(false);
  const detailLoading = ref(false);
  const currentTab = ref('built-in'); // built-in, my, market
  const searchQuery = ref('');
  const categoryFilter = ref('');

  // 计算属性
  const skillCount = computed(() => skills.value.length);

  // 按分类分组
  const skillsByCategory = computed(() => {
    const groups = {};
    skills.value.forEach(skill => {
      const category = skill.category || '未分类';
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(skill);
    });
    return groups;
  });

  // 内置技能
  const builtInSkills = computed(() => 
    skills.value.filter(s => s.type === 'built-in')
  );

  // 我的技能（已安装）
  const mySkills = computed(() => 
    skills.value.filter(s => s.installed)
  );

  // 市场技能
  const marketSkills = computed(() => 
    skills.value.filter(s => s.type === 'market')
  );

  // 获取技能列表
  async function fetchSkills(params = {}) {
    loading.value = true;
    try {
      const res = await skillApi.getList({
        type: currentTab.value,
        q: searchQuery.value,
        category: categoryFilter.value,
        ...params
      });
      if (res.success) {
        skills.value = res.skills;
      }
      return res;
    } catch (error) {
      console.error('获取技能列表失败:', error);
      return { success: false, error: error.message };
    } finally {
      loading.value = false;
    }
  }

  // 获取技能详情
  async function fetchSkillDetail(skillId) {
    detailLoading.value = true;
    try {
      const res = await skillApi.getDetail(skillId);
      if (res.success) {
        currentSkill.value = res.skill;
      }
      return res;
    } catch (error) {
      console.error('获取技能详情失败:', error);
      return { success: false, error: error.message };
    } finally {
      detailLoading.value = false;
    }
  }

  // 安装技能
  async function installSkill(skillId, options = {}) {
    try {
      const res = await skillApi.install(skillId, options);
      if (res.success) {
        // 更新本地状态
        const skill = skills.value.find(s => s.id === skillId);
        if (skill) {
          skill.installed = true;
          skill.installedAt = new Date().toISOString();
        }
      }
      return res;
    } catch (error) {
      console.error('安装技能失败:', error);
      return { success: false, error: error.message };
    }
  }

  // 卸载技能
  async function uninstallSkill(skillId) {
    try {
      const res = await skillApi.uninstall(skillId);
      if (res.success) {
        // 更新本地状态
        const skill = skills.value.find(s => s.id === skillId);
        if (skill) {
          skill.installed = false;
          skill.installedAt = null;
        }
        // 如果是当前选中的技能，清除选择
        if (currentSkill.value?.id === skillId) {
          currentSkill.value = null;
        }
      }
      return res;
    } catch (error) {
      console.error('卸载技能失败:', error);
      return { success: false, error: error.message };
    }
  }

  // 更新技能配置
  async function updateSkillConfig(skillId, config) {
    try {
      const res = await skillApi.updateConfig(skillId, config);
      if (res.success) {
        // 更新本地状态
        const skill = skills.value.find(s => s.id === skillId);
        if (skill) {
          skill.config = { ...skill.config, ...config };
        }
        if (currentSkill.value?.id === skillId) {
          currentSkill.value.config = { ...currentSkill.value.config, ...config };
        }
      }
      return res;
    } catch (error) {
      console.error('更新技能配置失败:', error);
      return { success: false, error: error.message };
    }
  }

  // 切换启用状态
  async function toggleSkillEnabled(skillId, enabled) {
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
      return { success: false, error: error.message };
    }
  }

  // 测试技能调用
  async function testSkillCall(skillId, params = {}) {
    try {
      const res = await skillApi.testCall(skillId, params);
      return res;
    } catch (error) {
      console.error('测试技能调用失败:', error);
      return { success: false, error: error.message };
    }
  }

  // 获取 MCP 服务器列表
  async function fetchMCPServers() {
    try {
      const res = await skillApi.getMCPServers();
      if (res.success) {
        mcpServers.value = res.servers;
      }
      return res;
    } catch (error) {
      console.error('获取 MCP 服务器列表失败:', error);
      return { success: false, error: error.message };
    }
  }

  // 添加 MCP 服务器
  async function addMCPServer(server) {
    try {
      const res = await skillApi.addMCPServer(server);
      if (res.success) {
        mcpServers.value.push(res.server);
      }
      return res;
    } catch (error) {
      console.error('添加 MCP 服务器失败:', error);
      return { success: false, error: error.message };
    }
  }

  // 更新 MCP 服务器
  async function updateMCPServer(serverId, server) {
    try {
      const res = await skillApi.updateMCPServer(serverId, server);
      if (res.success) {
        const index = mcpServers.value.findIndex(s => s.id === serverId);
        if (index !== -1) {
          mcpServers.value[index] = res.server;
        }
      }
      return res;
    } catch (error) {
      console.error('更新 MCP 服务器失败:', error);
      return { success: false, error: error.message };
    }
  }

  // 删除 MCP 服务器
  async function deleteMCPServer(serverId) {
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
      return { success: false, error: error.message };
    }
  }

  // 获取分类列表
  async function fetchCategories() {
    try {
      const res = await skillApi.getCategories();
      if (res.success) {
        categories.value = res.categories;
      }
      return res;
    } catch (error) {
      console.error('获取分类列表失败:', error);
      return { success: false, error: error.message };
    }
  }

  // 选择技能
  function selectSkill(skill) {
    currentSkill.value = skill;
  }

  // 清除选择
  function clearSelection() {
    currentSkill.value = null;
  }

  // 设置当前 Tab
  function setCurrentTab(tab) {
    currentTab.value = tab;
  }

  // 设置搜索关键词
  function setSearchQuery(query) {
    searchQuery.value = query;
  }

  // 设置分类筛选
  function setCategoryFilter(category) {
    categoryFilter.value = category;
  }

  return {
    // 状态
    skills,
    currentSkill,
    mcpServers,
    categories,
    loading,
    detailLoading,
    currentTab,
    searchQuery,
    categoryFilter,
    // 计算属性
    skillCount,
    skillsByCategory,
    builtInSkills,
    mySkills,
    marketSkills,
    // 方法
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

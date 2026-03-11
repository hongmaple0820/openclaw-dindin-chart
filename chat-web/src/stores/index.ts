/**
 * Pinia 状态管理配置
 * @author 小琳
 * @date 2026-02-06
 */
import { createPinia } from 'pinia';

const pinia = createPinia();

export default pinia;

// 导出所有 Store
export { useUserStore } from './user';
export { useGroupStore } from './groups';
export { useFriendStore } from './friends';
export { useAgentsStore } from './agents';
export { useSkillStore } from './skills';
export { useWorkspaceStore } from './workspace';
export { useTaskStore } from './tasks';
export { useProjectStore } from './projects';
export { useSandboxStore } from './sandbox';
export { useSchedulerStore } from './scheduler';
export { useSettingsStore } from './settings';
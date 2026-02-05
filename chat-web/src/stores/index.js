/**
 * Pinia 状态管理入口
 * @author 小琳
 * @date 2026-02-06
 */
import { createPinia } from 'pinia';

const pinia = createPinia();

export default pinia;

// 导出所有 store
export * from './user';

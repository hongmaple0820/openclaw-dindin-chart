/**
 * Store 状态类型定义
 * @author 小琳
 * @date 2026-03-11
 */

import type {
  User,
  Group,
  Friend,
  FriendRequest,
  Agent,
  Skill,
  Workspace,
  Task,
  Project,
  Sandbox,
  SchedulerJob,
  Notification
} from './models';

export interface UserState {
  user: User | null;
  accessToken: string;
  refreshToken: string;
}

export interface GroupsState {
  groups: Group[];
  currentGroup: Group | null;
  loading: boolean;
  error: string | null;
}

export interface FriendsState {
  friends: Friend[];
  requests: FriendRequest[];
  loading: boolean;
  error: string | null;
}

export interface AgentsState {
  agents: Agent[];
  currentAgent: Agent | null;
  loading: boolean;
  error: string | null;
}

export interface SkillsState {
  skills: Skill[];
  currentSkill: Skill | null;
  loading: boolean;
  error: string | null;
}

export interface WorkspacesState {
  workspaces: Workspace[];
  currentWorkspace: Workspace | null;
  loading: boolean;
  error: string | null;
}

export interface TasksState {
  tasks: Task[];
  currentTask: Task | null;
  loading: boolean;
  error: string | null;
}

export interface ProjectsState {
  projects: Project[];
  currentProject: Project | null;
  loading: boolean;
  error: string | null;
}

export interface SandboxState {
  sandboxes: Sandbox[];
  currentSandbox: Sandbox | null;
  loading: boolean;
  error: string | null;
}

export interface SchedulerState {
  jobs: SchedulerJob[];
  loading: boolean;
  error: string | null;
}

export interface SettingsState {
  theme: 'light' | 'dark' | 'auto';
  language: string;
  notifications: boolean;
  soundEnabled: boolean;
}

export interface NotificationsState {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
}
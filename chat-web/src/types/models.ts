/**
 * 数据模型类型定义
 * @author 小琳
 * @date 2026-03-11
 */

export interface User {
  id: string;
  username: string;
  nickname?: string;
  email?: string;
  avatar?: string;
  role: 'user' | 'admin';
  createdAt: string;
}

export interface Message {
  id: string;
  content: string;
  sender: string;
  senderName?: string;
  senderAvatar?: string;
  groupId?: string;
  recipientId?: string;
  timestamp: string;
  type?: 'text' | 'image' | 'file';
}

export interface Group {
  id: string;
  name: string;
  description?: string;
  avatar?: string;
  ownerId: string;
  members: GroupMember[];
  createdAt: string;
}

export interface GroupMember {
  userId: string;
  username: string;
  nickname?: string;
  avatar?: string;
  role: 'owner' | 'admin' | 'member';
  joinedAt: string;
}

export interface Friend {
  id: string;
  username: string;
  nickname?: string;
  avatar?: string;
  status: 'online' | 'offline' | 'busy';
}

export interface FriendRequest {
  id: string;
  fromUserId: string;
  fromUsername: string;
  fromAvatar?: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: string;
}

export interface Agent {
  id: string;
  name: string;
  description?: string;
  avatar?: string;
  model?: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  enabled: boolean;
  createdAt: string;
}

export interface Skill {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  enabled: boolean;
  config?: Record<string, unknown>;
  createdAt: string;
}

export interface Workspace {
  id: string;
  name: string;
  description?: string;
  ownerId: string;
  members: WorkspaceMember[];
  files: WorkspaceFile[];
  createdAt: string;
}

export interface WorkspaceMember {
  userId: string;
  username: string;
  role: 'owner' | 'admin' | 'member';
}

export interface WorkspaceFile {
  id: string;
  name: string;
  path: string;
  size: number;
  type: string;
  createdAt: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: 'todo' | 'in_progress' | 'done' | 'cancelled';
  priority: 'low' | 'medium' | 'high';
  assignee?: string;
  assigneeName?: string;
  dueDate?: string;
  projectId?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  ownerId: string;
  members: ProjectMember[];
  skills: string[];
  tasks: string[];
  createdAt: string;
}

export interface ProjectMember {
  userId: string;
  username: string;
  role: 'owner' | 'admin' | 'member';
}

export interface Sandbox {
  id: string;
  name: string;
  image?: string;
  status: 'running' | 'stopped' | 'error' | 'creating';
  port?: number;
  containerId?: string;
  createdAt: string;
}

export interface SchedulerJob {
  id: string;
  name: string;
  cron: string;
  command: string;
  enabled: boolean;
  lastRun?: string;
  nextRun?: string;
  createdAt: string;
}

export interface Notification {
  id: string;
  type: 'message' | 'mention' | 'system' | 'friend_request';
  title: string;
  content: string;
  read: boolean;
  createdAt: string;
}

export interface ObservabilityMetrics {
  cpu: number;
  memory: number;
  disk: number;
  network: {
    in: number;
    out: number;
  };
  uptime: number;
  connections: number;
}
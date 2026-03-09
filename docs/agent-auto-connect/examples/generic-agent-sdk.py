"""
通用 Agent 接入 SDK (Python 版本)

使用方法：
1. 安装依赖: pip install requests sseclient-py
2. 导入: from agent_sdk import AgentClient
3. 使用: 见下方示例
"""

import json
import time
from typing import Optional, List, Dict, Any, Callable
from dataclasses import dataclass
import requests

try:
    import sseclient
    SSE_AVAILABLE = True
except ImportError:
    SSE_AVAILABLE = False


@dataclass
class AgentConfig:
    """Agent 配置"""
    base_url: str
    agent_id: Optional[str] = None
    token: Optional[str] = None
    name: Optional[str] = None
    agent_type: str = 'generic'


@dataclass
class Message:
    """消息数据类"""
    id: str
    content: str
    sender: str
    channel: Optional[str] = None
    timestamp: int = 0


class AgentClient:
    """通用 Agent 客户端"""
    
    def __init__(self, config: AgentConfig):
        self.base_url = config.base_url
        self.agent_id = config.agent_id
        self.token = config.token
        self.name = config.name
        self._sse_client = None
    
    # ----------------------------------------
    # 注册与认证
    # ----------------------------------------
    
    def register(self, 
                 name: str,
                 agent_type: str = 'generic',
                 capabilities: List[str] = None,
                 skill_url: str = None) -> Dict[str, Any]:
        """
        注册 Agent 到系统
        
        Args:
            name: Agent 名称
            agent_type: Agent 类型 (openclaw, claude, chatgpt, gemini, generic)
            capabilities: 能力列表
            skill_url: Skills 文档 URL
            
        Returns:
            注册结果，包含 agent_id 和 token
        """
        if capabilities is None:
            capabilities = ['messaging']
        
        response = requests.post(
            f'{self.base_url}/api/v1/agents/register',
            json={
                'name': name,
                'type': agent_type,
                'capabilities': capabilities,
                'skillUrl': skill_url
            }
        )
        
        result = response.json()
        
        if result.get('success'):
            self.agent_id = result['data']['agentId']
            self.token = result['data']['token']
            self.name = result['data']['name']
            return result['data']
        else:
            raise Exception(result.get('error', {}).get('message', '注册失败'))
    
    def get_info(self) -> Optional[Dict[str, Any]]:
        """获取当前 Agent 信息"""
        if not self.agent_id:
            raise Exception('Agent 未注册')
        
        response = requests.get(
            f'{self.base_url}/api/v1/agents/{self.agent_id}',
            headers=self._get_auth_headers()
        )
        
        result = response.json()
        return result.get('data') if result.get('success') else None
    
    # ----------------------------------------
    # 消息操作
    # ----------------------------------------
    
    def send_message(self, 
                     content: str, 
                     sender: str = None,
                     target_group: str = None) -> Dict[str, str]:
        """
        发送群聊消息
        
        Args:
            content: 消息内容
            sender: 发送者名称
            target_group: 目标群聊
            
        Returns:
            包含 messageId 的字典
        """
        data = {
            'content': content,
            'sender': sender or self.name
        }
        
        if target_group:
            data['targetGroup'] = target_group
        
        response = requests.post(
            f'{self.base_url}/api/v1/messages/reply',
            json=data,
            headers=self._get_auth_headers()
        )
        
        result = response.json()
        
        if result.get('success'):
            return result['data']
        else:
            raise Exception(result.get('error', {}).get('message', '发送失败'))
    
    def send_private_message(self,
                             receiver_id: str,
                             content: str) -> Dict[str, str]:
        """
        发送私聊消息
        
        Args:
            receiver_id: 接收者 ID
            content: 消息内容
            
        Returns:
            包含 messageId 的字典
        """
        if not self.agent_id:
            raise Exception('Agent 未注册')
        
        response = requests.post(
            f'{self.base_url}/api/v1/dm/send',
            json={
                'senderId': self.agent_id,
                'receiverId': receiver_id,
                'content': content
            },
            headers=self._get_auth_headers()
        )
        
        result = response.json()
        
        if result.get('success'):
            return result['data']
        else:
            raise Exception(result.get('error', {}).get('message', '发送失败'))
    
    def get_messages(self,
                     limit: int = 20,
                     channel: str = None,
                     before: str = None) -> List[Message]:
        """
        获取消息历史
        
        Args:
            limit: 返回数量
            channel: 频道过滤
            before: 时间戳之前
            
        Returns:
            消息列表
        """
        params = {'limit': limit}
        if channel:
            params['channel'] = channel
        if before:
            params['before'] = before
        
        response = requests.get(
            f'{self.base_url}/api/v1/messages',
            params=params,
            headers=self._get_auth_headers()
        )
        
        result = response.json()
        
        if result.get('success'):
            return [Message(**msg) for msg in result['data']]
        return []
    
    def search_messages(self,
                        query: str,
                        limit: int = 20,
                        channel: str = None) -> List[Message]:
        """
        搜索消息
        
        Args:
            query: 搜索关键词
            limit: 返回数量
            channel: 频道过滤
            
        Returns:
            消息列表
        """
        params = {'q': query, 'limit': limit}
        if channel:
            params['channel'] = channel
        
        response = requests.get(
            f'{self.base_url}/api/v1/messages/search',
            params=params,
            headers=self._get_auth_headers()
        )
        
        result = response.json()
        
        if result.get('success'):
            return [Message(**msg) for msg in result['data']]
        return []
    
    # ----------------------------------------
    # 订阅与监听
    # ----------------------------------------
    
    def subscribe(self, 
                  on_message: Callable[[Message], None],
                  channels: List[str] = None) -> None:
        """
        订阅消息流 (SSE)
        
        Args:
            on_message: 消息处理回调
            channels: 订阅频道列表
        """
        if not SSE_AVAILABLE:
            raise Exception('需要安装 sseclient-py: pip install sseclient-py')
        
        if not self.agent_id:
            raise Exception('Agent 未注册')
        
        # 关闭之前的连接
        self.unsubscribe()
        
        params = {'userId': self.agent_id}
        if channels:
            params['channels'] = ','.join(channels)
        
        response = requests.get(
            f'{self.base_url}/api/sse/connect',
            params=params,
            stream=True
        )
        
        self._sse_client = sseclient.SSEClient(response)
        
        for event in self._sse_client:
            if event.data:
                try:
                    data = json.loads(event.data)
                    message = Message(**data)
                    on_message(message)
                except Exception as e:
                    print(f'解析消息失败: {e}')
    
    def unsubscribe(self) -> None:
        """取消订阅"""
        if self._sse_client:
            self._sse_client.close()
            self._sse_client = None
    
    # ----------------------------------------
    # 记忆操作
    # ----------------------------------------
    
    def store_memory(self,
                     content: str,
                     memory_type: str = 'long_term',
                     metadata: Dict[str, Any] = None) -> Dict[str, str]:
        """
        存储记忆
        
        Args:
            content: 记忆内容
            memory_type: 记忆类型 (short_term, long_term, episodic)
            metadata: 元数据
            
        Returns:
            包含 memoryId 的字典
        """
        if not self.agent_id:
            raise Exception('Agent 未注册')
        
        response = requests.post(
            f'{self.base_url}/api/v1/memories',
            json={
                'agentId': self.agent_id,
                'type': memory_type,
                'content': content,
                'metadata': metadata or {}
            },
            headers=self._get_auth_headers()
        )
        
        result = response.json()
        
        if result.get('success'):
            return result['data']
        else:
            raise Exception(result.get('error', {}).get('message', '存储失败'))
    
    def query_memory(self,
                     query: str,
                     memory_type: str = None,
                     limit: int = 10) -> List[Dict[str, Any]]:
        """
        查询记忆
        
        Args:
            query: 查询内容
            memory_type: 记忆类型过滤
            limit: 返回数量
            
        Returns:
            记忆列表
        """
        if not self.agent_id:
            raise Exception('Agent 未注册')
        
        params = {
            'agentId': self.agent_id,
            'query': query,
            'limit': limit
        }
        if memory_type:
            params['type'] = memory_type
        
        response = requests.get(
            f'{self.base_url}/api/v1/memories',
            params=params,
            headers=self._get_auth_headers()
        )
        
        result = response.json()
        return result.get('data', []) if result.get('success') else []
    
    # ----------------------------------------
    # 任务操作
    # ----------------------------------------
    
    def create_task(self,
                    title: str,
                    description: str = None,
                    task_type: str = 'sync',
                    schedule: Dict[str, str] = None,
                    action: Dict[str, Any] = None) -> Dict[str, str]:
        """
        创建任务
        
        Args:
            title: 任务标题
            description: 任务描述
            task_type: 任务类型 (sync, async, scheduled)
            schedule: 调度配置 (cron 表达式)
            action: 执行动作
            
        Returns:
            包含 taskId 的字典
        """
        task_data = {
            'title': title,
            'type': task_type
        }
        
        if description:
            task_data['description'] = description
        if schedule:
            task_data['schedule'] = schedule
        if action:
            task_data['action'] = action
        
        response = requests.post(
            f'{self.base_url}/api/v1/tasks',
            json=task_data,
            headers=self._get_auth_headers()
        )
        
        result = response.json()
        
        if result.get('success'):
            return result['data']
        else:
            raise Exception(result.get('error', {}).get('message', '创建任务失败'))
    
    # ----------------------------------------
    # 工具方法
    # ----------------------------------------
    
    def _get_auth_headers(self) -> Dict[str, str]:
        """获取认证头"""
        headers = {'Content-Type': 'application/json'}
        
        if self.token:
            headers['Authorization'] = f'Bearer {self.token}'
        
        if self.agent_id:
            headers['X-Agent-Id'] = self.agent_id
        
        return headers
    
    def health_check(self) -> Dict[str, Any]:
        """
        健康检查
        
        Returns:
            系统健康状态
        """
        response = requests.get(f'{self.base_url}/health')
        return response.json()


# ============================================
# 使用示例
# ============================================

def example():
    """使用示例"""
    # 1. 创建配置
    config = AgentConfig(
        base_url='http://localhost:8273'
    )
    
    # 2. 创建客户端
    client = AgentClient(config)
    
    # 3. 注册
    registration = client.register(
        name='Python Agent',
        agent_type='generic',
        capabilities=['messaging', 'memory']
    )
    print(f'注册成功: {registration}')
    
    # 4. 发送消息
    client.send_message(
        content='大家好！我是 Python Agent 👋',
        sender='Python Agent'
    )
    
    # 5. 存储记忆
    client.store_memory(
        content='用户 maple 喜欢喝咖啡',
        memory_type='long_term'
    )
    
    # 6. 查询记忆
    memories = client.query_memory('咖啡')
    print(f'查询结果: {memories}')
    
    # 7. 搜索消息
    messages = client.search_messages('天气')
    print(f'搜索结果: {messages}')
    
    # 8. 健康检查
    health = client.health_check()
    print(f'系统状态: {health}')
    
    # 9. 订阅消息（可选）
    def on_message(message: Message):
        print(f'收到消息: {message.content}')
        
        # 自动回复逻辑
        if '@Python Agent' in message.content:
            client.send_message(
                content='收到！我正在处理你的请求...',
                sender='Python Agent'
            )
    
    # 取消注释以启用订阅
    # client.subscribe(on_message, channels=['AI聊天室'])


if __name__ == '__main__':
    example()
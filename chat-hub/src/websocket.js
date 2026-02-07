/**
 * WebSocket 实时消息推送
 * @author 小琳
 * @date 2026-02-06
 */

const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');

let wss = null;
const clients = new Map(); // clientId -> { ws, user, rooms }

/**
 * 初始化 WebSocket 服务器
 */
function init(server) {
  wss = new WebSocket.Server({ server, path: '/ws' });
  
  wss.on('connection', (ws, req) => {
    const clientId = uuidv4();
    const clientInfo = {
      ws,
      user: null,
      rooms: new Set(['public']) // 默认加入公共聊天室
    };
    clients.set(clientId, clientInfo);
    
    console.log(`[WS] 新连接: ${clientId}, 当前在线: ${clients.size}`);
    
    // 发送连接成功消息
    send(ws, {
      type: 'connected',
      clientId,
      online: clients.size
    });
    
    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        handleMessage(clientId, msg);
      } catch (e) {
        console.error('[WS] 消息解析错误:', e);
      }
    });
    
    ws.on('close', () => {
      const info = clients.get(clientId);
      clients.delete(clientId);
      console.log(`[WS] 连接断开: ${clientId}, 剩余在线: ${clients.size}`);
      
      // 广播用户离线
      if (info?.user) {
        broadcast({
          type: 'user_offline',
          user: info.user,
          online: clients.size
        });
      }
    });
    
    ws.on('error', (err) => {
      console.error('[WS] 连接错误:', err.message);
    });
  });
  
  console.log('[WS] WebSocket 服务已启动');
  return wss;
}

/**
 * 处理客户端消息
 */
function handleMessage(clientId, msg) {
  const client = clients.get(clientId);
  if (!client) return;
  
  switch (msg.type) {
    case 'auth':
      // 用户认证
      client.user = msg.user;
      console.log(`[WS] 用户认证: ${msg.user?.username || msg.user?.nickname}`);
      broadcast({
        type: 'user_online',
        user: client.user,
        online: clients.size
      });
      break;
      
    case 'join':
      // 加入房间
      if (msg.room) {
        client.rooms.add(msg.room);
        send(client.ws, { type: 'joined', room: msg.room });
      }
      break;
      
    case 'leave':
      // 离开房间
      if (msg.room) {
        client.rooms.delete(msg.room);
        send(client.ws, { type: 'left', room: msg.room });
      }
      break;
      
    case 'ping':
      send(client.ws, { type: 'pong', timestamp: Date.now() });
      break;
      
    default:
      console.log('[WS] 未知消息类型:', msg.type);
  }
}

/**
 * 发送消息给单个客户端
 */
function send(ws, data) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

/**
 * 广播消息给所有客户端
 */
function broadcast(data, room = 'public') {
  const message = JSON.stringify(data);
  let sent = 0;
  
  clients.forEach((client) => {
    if (client.ws.readyState === WebSocket.OPEN) {
      if (room === '*' || client.rooms.has(room)) {
        client.ws.send(message);
        sent++;
      }
    }
  });
  
  return sent;
}

/**
 * 推送新消息
 */
function pushMessage(message, room = 'public') {
  return broadcast({
    type: 'new_message',
    message,
    timestamp: Date.now()
  }, room);
}

/**
 * 获取在线用户列表
 */
function getOnlineUsers() {
  const users = [];
  clients.forEach((client) => {
    if (client.user) {
      users.push(client.user);
    }
  });
  return users;
}

/**
 * 获取在线人数
 */
function getOnlineCount() {
  return clients.size;
}

module.exports = {
  init,
  broadcast,
  pushMessage,
  getOnlineUsers,
  getOnlineCount
};

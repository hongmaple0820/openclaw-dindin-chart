/**
 * API 自动化测试
 * @author 小琳
 * @date 2026-02-06
 * 
 * 运行：node tests/api-test.js
 */

const BASE_URL = 'http://localhost:3001';
let token = null;
let testUserId = null;

// 简单的测试框架
const tests = [];
let passed = 0;
let failed = 0;

function test(name, fn) {
  tests.push({ name, fn });
}

async function runTests() {
  console.log('🧪 开始 API 测试...\n');
  
  for (const t of tests) {
    try {
      await t.fn();
      console.log(`✅ ${t.name}`);
      passed++;
    } catch (error) {
      console.log(`❌ ${t.name}`);
      console.log(`   错误: ${error.message}`);
      failed++;
    }
  }
  
  console.log(`\n📊 测试结果: ${passed} 通过, ${failed} 失败`);
  process.exit(failed > 0 ? 1 : 0);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

async function request(method, path, body = null, headers = {}) {
  const url = `${BASE_URL}${path}`;
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers
    }
  };
  
  if (body) {
    options.body = JSON.stringify(body);
  }
  
  if (token) {
    options.headers['Authorization'] = `Bearer ${token}`;
  }
  
  const response = await fetch(url, options);
  const data = await response.json();
  return { status: response.status, data };
}

// ==================== 测试用例 ====================

test('健康检查', async () => {
  const { status, data } = await request('GET', '/health');
  assert(status === 200, `状态码应为 200, 实际为 ${status}`);
  assert(data.status === 'ok', '健康检查应返回 ok');
});

test('用户注册', async () => {
  const username = `test_${Date.now()}`;
  const { status, data } = await request('POST', '/api/auth/register', {
    username,
    password: 'test123456',
    email: `${username}@test.com`
  });
  assert(data.success === true, '注册应成功');
  assert(data.user && data.user.id, '应返回用户 ID');
  testUserId = data.user.id;
});

test('用户登录', async () => {
  const { status, data } = await request('POST', '/api/auth/login', {
    username: 'webtest1',
    password: 'test123'
  });
  assert(data.success === true, '登录应成功');
  assert(data.accessToken, '应返回 accessToken');
  token = data.accessToken;
});

test('获取当前用户信息', async () => {
  const { status, data } = await request('GET', '/api/user/profile');
  assert(status === 200, `状态码应为 200, 实际为 ${status}`);
  assert(data.success === true, '应成功获取用户信息');
  assert(data.user && data.user.username, '应返回用户名');
});

test('发送私信', async () => {
  const { status, data } = await request('POST', '/api/dm/send', {
    receiverId: 'test-receiver-001',
    receiverName: '测试接收者',
    content: '这是一条自动化测试私信'
  });
  assert(data.success === true, '发送私信应成功');
  assert(data.message && data.message.id, '应返回消息 ID');
});

test('获取会话列表', async () => {
  const { status, data } = await request('GET', '/api/dm/conversations');
  assert(status === 200, `状态码应为 200, 实际为 ${status}`);
  assert(data.success === true, '获取会话列表应成功');
  assert(Array.isArray(data.conversations), '应返回会话数组');
});

test('获取未读消息数', async () => {
  const { status, data } = await request('GET', '/api/dm/unread');
  assert(status === 200, `状态码应为 200, 实际为 ${status}`);
  assert(data.success === true, '获取未读数应成功');
  assert(typeof data.unreadCount === 'number', '应返回未读数');
});

test('搜索私信', async () => {
  const { status, data } = await request('GET', '/api/dm/search?q=测试');
  assert(status === 200, `状态码应为 200, 实际为 ${status}`);
  assert(data.success === true, '搜索应成功');
  assert(Array.isArray(data.results), '应返回结果数组');
});

test('未授权访问应返回 401', async () => {
  const savedToken = token;
  token = null;
  
  const { status } = await request('GET', '/api/user/profile');
  assert(status === 401, `未授权访问应返回 401, 实际为 ${status}`);
  
  token = savedToken;
});

// 运行测试
runTests().catch(console.error);

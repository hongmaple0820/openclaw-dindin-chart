/**
 * 浏览器 E2E 自动化测试
 * @author 小琳
 * @date 2026-02-06
 * 
 * 使用 Playwright 进行浏览器自动化测试
 * 安装：npm install playwright
 * 运行：node tests/e2e-test.js
 */

const { chromium } = require('playwright');

const BASE_URL = 'http://localhost:5173';
const API_URL = 'http://localhost:3001';

let browser, page;
let testResults = { passed: 0, failed: 0, tests: [] };

async function test(name, fn) {
  try {
    await fn();
    console.log(`✅ ${name}`);
    testResults.passed++;
    testResults.tests.push({ name, status: 'passed' });
  } catch (error) {
    console.log(`❌ ${name}`);
    console.log(`   错误: ${error.message}`);
    testResults.failed++;
    testResults.tests.push({ name, status: 'failed', error: error.message });
  }
}

async function setup() {
  console.log('🚀 启动浏览器...\n');
  browser = await chromium.launch({ 
    headless: true,
    args: ['--no-sandbox']
  });
  page = await browser.newPage();
  page.setDefaultTimeout(10000);
}

async function teardown() {
  if (browser) {
    await browser.close();
  }
  
  console.log(`\n📊 E2E 测试结果: ${testResults.passed} 通过, ${testResults.failed} 失败`);
  process.exit(testResults.failed > 0 ? 1 : 0);
}

// ==================== E2E 测试用例 ====================

async function runTests() {
  await setup();
  
  console.log('🧪 开始 E2E 测试...\n');
  
  // 测试首页加载
  await test('首页加载', async () => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    const title = await page.title();
    if (!title) throw new Error('页面标题为空');
  });
  
  // 测试登录页面
  await test('登录页面可访问', async () => {
    await page.goto(`${BASE_URL}/login`);
    await page.waitForSelector('input[type="text"], input[name="username"]', { timeout: 5000 });
  });
  
  // 测试注册页面
  await test('注册页面可访问', async () => {
    await page.goto(`${BASE_URL}/register`);
    await page.waitForLoadState('networkidle');
    // 检查是否有注册表单元素
    const hasForm = await page.$('form, input');
    if (!hasForm) throw new Error('注册页面没有表单');
  });
  
  // 测试登录功能
  await test('用户登录', async () => {
    await page.goto(`${BASE_URL}/login`);
    await page.waitForLoadState('networkidle');
    
    // 填写登录表单
    await page.fill('input[type="text"], input[name="username"]', 'webtest1');
    await page.fill('input[type="password"]', 'test123');
    
    // 提交表单
    await page.click('button[type="submit"], .login-btn, button:has-text("登录")');
    
    // 等待响应
    await page.waitForTimeout(2000);
    
    // 检查是否登录成功（检查成功提示或跳转）
    const successText = await page.textContent('body').catch(() => '');
    const url = page.url();
    
    // 如果有"登录成功"或已跳转，则视为成功
    if (successText.includes('登录成功') || !url.includes('/login')) {
      // 登录成功
      return;
    }
    
    throw new Error('登录未成功');
  });
  
  // 测试私信页面
  await test('私信页面可访问', async () => {
    await page.goto(`${BASE_URL}/dm`);
    await page.waitForLoadState('networkidle');
    // 可能需要登录，暂时只检查页面加载
  });
  
  // 测试聊天室页面
  await test('聊天室页面可访问', async () => {
    await page.goto(`${BASE_URL}/chat`);
    await page.waitForLoadState('networkidle');
  });
  
  // 测试 API 健康检查
  await test('API 健康检查', async () => {
    const response = await page.request.get(`${API_URL}/health`);
    const data = await response.json();
    if (data.status !== 'ok') throw new Error('API 不健康');
  });
  
  // 截图保存（用于调试）
  await test('截取当前页面', async () => {
    await page.screenshot({ 
      path: '/tmp/e2e-test-screenshot.png',
      fullPage: true 
    });
  });
  
  await teardown();
}

// 运行测试
runTests().catch(async (error) => {
  console.error('测试运行失败:', error);
  if (browser) await browser.close();
  process.exit(1);
});

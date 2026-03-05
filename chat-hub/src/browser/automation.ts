/**
 * 浏览器自动化服务
 * 
 * 基于 Playwright 实现网页自动化操作
 * 
 * @author 小琳
 * @date 2026-03-05
 */

import { chromium, Browser, Page, BrowserContext } from 'playwright';

// ============================================================
// 类型定义
// ============================================================

/** 浏览器操作类型 */
export type BrowserAction = 
  | 'navigate'
  | 'click'
  | 'type'
  | 'screenshot'
  | 'snapshot'
  | 'scroll'
  | 'wait'
  | 'extract';

/** 浏览器操作参数 */
export interface BrowserActionParams {
  action: BrowserAction;
  url?: string;
  selector?: string;
  text?: string;
  timeout?: number;
  waitFor?: 'load' | 'domcontentloaded' | 'networkidle';
}

/** 浏览器操作结果 */
export interface BrowserActionResult {
  success: boolean;
  action: BrowserAction;
  data?: unknown;
  error?: string;
  screenshot?: string;  // Base64
  timestamp: number;
}

/** 语义快照 */
export interface SemanticSnapshot {
  url: string;
  title: string;
  elements: SemanticElement[];
  forms: FormElement[];
  links: LinkElement[];
  text: string;
}

/** 语义元素 */
export interface SemanticElement {
  type: 'button' | 'input' | 'select' | 'textarea' | 'heading' | 'text' | 'image';
  selector: string;
  text?: string;
  label?: string;
  placeholder?: string;
  visible: boolean;
  enabled?: boolean;
}

/** 表单元素 */
export interface FormElement {
  selector: string;
  action?: string;
  method?: string;
  inputs: Array<{
    name: string;
    type: string;
    label?: string;
    required: boolean;
  }>;
}

/** 链接元素 */
export interface LinkElement {
  text: string;
  href: string;
  selector: string;
}

/** 浏览器配置 */
export interface BrowserConfig {
  headless: boolean;
  timeout: number;
  viewport: { width: number; height: number };
  userAgent?: string;
  locale?: string;
}

// ============================================================
// 浏览器自动化服务
// ============================================================

/**
 * 浏览器自动化服务
 */
export class BrowserAutomation {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private config: BrowserConfig;

  constructor(config: Partial<BrowserConfig> = {}) {
    this.config = {
      headless: config.headless ?? true,
      timeout: config.timeout ?? 30000,
      viewport: config.viewport ?? { width: 1280, height: 720 },
      userAgent: config.userAgent,
      locale: config.locale ?? 'zh-CN'
    };
  }

  /**
   * 启动浏览器
   */
  async start(): Promise<void> {
    if (this.browser) {
      console.log('[Browser] 浏览器已启动');
      return;
    }

    console.log('[Browser] 启动浏览器...');
    
    this.browser = await chromium.launch({
      headless: this.config.headless
    });

    this.context = await this.browser.newContext({
      viewport: this.config.viewport,
      userAgent: this.config.userAgent,
      locale: this.config.locale
    });

    this.page = await this.context.newPage();
    this.page.setDefaultTimeout(this.config.timeout);

    console.log('[Browser] 浏览器启动成功');
  }

  /**
   * 关闭浏览器
   */
  async stop(): Promise<void> {
    if (this.page) {
      await this.page.close();
      this.page = null;
    }

    if (this.context) {
      await this.context.close();
      this.context = null;
    }

    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }

    console.log('[Browser] 浏览器已关闭');
  }

  /**
   * 执行操作
   */
  async execute(params: BrowserActionParams): Promise<BrowserActionResult> {
    const startTime = Date.now();

    try {
      if (!this.page) {
        await this.start();
      }

      let data: unknown;

      switch (params.action) {
        case 'navigate':
          data = await this.navigate(params.url!, params.waitFor);
          break;
        case 'click':
          data = await this.click(params.selector!);
          break;
        case 'type':
          data = await this.type(params.selector!, params.text!);
          break;
        case 'screenshot':
          data = await this.screenshot();
          break;
        case 'snapshot':
          data = await this.snapshot();
          break;
        case 'scroll':
          data = await this.scroll(params.selector);
          break;
        case 'wait':
          data = await this.wait(params.selector, params.timeout);
          break;
        case 'extract':
          data = await this.extract(params.selector!);
          break;
        default:
          throw new Error(`未知操作: ${params.action}`);
      }

      return {
        success: true,
        action: params.action,
        data,
        timestamp: Date.now()
      };
    } catch (error) {
      return {
        success: false,
        action: params.action,
        error: error instanceof Error ? error.message : String(error),
        timestamp: Date.now()
      };
    }
  }

  /**
   * 导航到 URL
   */
  private async navigate(url: string, waitFor: 'load' | 'domcontentloaded' | 'networkidle' = 'load'): Promise<string> {
    if (!this.page) throw new Error('页面未初始化');

    await this.page.goto(url, { waitUntil: waitFor });
    return this.page.url();
  }

  /**
   * 点击元素
   */
  private async click(selector: string): Promise<boolean> {
    if (!this.page) throw new Error('页面未初始化');

    await this.page.click(selector);
    return true;
  }

  /**
   * 输入文本
   */
  private async type(selector: string, text: string): Promise<boolean> {
    if (!this.page) throw new Error('页面未初始化');

    await this.page.fill(selector, text);
    return true;
  }

  /**
   * 截图
   */
  private async screenshot(): Promise<string> {
    if (!this.page) throw new Error('页面未初始化');

    const buffer = await this.page.screenshot({ fullPage: false });
    return buffer.toString('base64');
  }

  /**
   * 生成语义快照
   */
  private async snapshot(): Promise<SemanticSnapshot> {
    if (!this.page) throw new Error('页面未初始化');

    const url = this.page.url();
    const title = await this.page.title();

    // 提取页面元素
    const elements = await this.extractElements();
    const forms = await this.extractForms();
    const links = await this.extractLinks();
    const text = await this.page.evaluate(() => document.body.innerText);

    return {
      url,
      title,
      elements,
      forms,
      links,
      text: text.slice(0, 5000)  // 限制文本长度
    };
  }

  /**
   * 滚动页面
   */
  private async scroll(selector?: string): Promise<boolean> {
    if (!this.page) throw new Error('页面未初始化');

    if (selector) {
      await this.page.locator(selector).scrollIntoViewIfNeeded();
    } else {
      await this.page.evaluate(() => window.scrollBy(0, window.innerHeight));
    }

    return true;
  }

  /**
   * 等待元素
   */
  private async wait(selector?: string, timeout?: number): Promise<boolean> {
    if (!this.page) throw new Error('页面未初始化');

    if (selector) {
      await this.page.waitForSelector(selector, { timeout: timeout || this.config.timeout });
    } else {
      await this.page.waitForTimeout(timeout || 1000);
    }

    return true;
  }

  /**
   * 提取数据
   */
  private async extract(selector: string): Promise<unknown> {
    if (!this.page) throw new Error('页面未初始化');

    const elements = await this.page.$$(selector);
    const results = [];

    for (const element of elements) {
      const text = await element.textContent();
      const html = await element.innerHTML();
      results.push({ text, html });
    }

    return results;
  }

  /**
   * 提取语义元素
   */
  private async extractElements(): Promise<SemanticElement[]> {
    if (!this.page) throw new Error('页面未初始化');

    return await this.page.evaluate(() => {
      const elements: SemanticElement[] = [];

      // 提取按钮
      document.querySelectorAll('button, [role="button"], input[type="button"], input[type="submit"]').forEach((el, i) => {
        elements.push({
          type: 'button',
          selector: el.id ? `#${el.id}` : `button:nth-of-type(${i + 1})`,
          text: el.textContent?.trim() || undefined,
          visible: (el as HTMLElement).offsetParent !== null,
          enabled: !(el as HTMLButtonElement).disabled
        });
      });

      // 提取输入框
      document.querySelectorAll('input, textarea, select').forEach((el, i) => {
        const input = el as HTMLInputElement;
        elements.push({
          type: input.tagName.toLowerCase() === 'select' ? 'select' : 
                input.tagName.toLowerCase() === 'textarea' ? 'textarea' : 'input',
          selector: input.id ? `#${input.id}` : input.name ? `[name="${input.name}"]` : `input:nth-of-type(${i + 1})`,
          label: input.labels?.[0]?.textContent?.trim() || undefined,
          placeholder: input.placeholder || undefined,
          visible: input.offsetParent !== null,
          enabled: !input.disabled
        });
      });

      // 提取标题
      document.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach((el, i) => {
        elements.push({
          type: 'heading',
          selector: el.id ? `#${el.id}` : `${el.tagName.toLowerCase()}:nth-of-type(${i + 1})`,
          text: el.textContent?.trim() || undefined,
          visible: (el as HTMLElement).offsetParent !== null
        });
      });

      return elements;
    });
  }

  /**
   * 提取表单
   */
  private async extractForms(): Promise<FormElement[]> {
    if (!this.page) throw new Error('页面未初始化');

    return await this.page.evaluate(() => {
      const forms: FormElement[] = [];

      document.querySelectorAll('form').forEach((form) => {
        const inputs = Array.from(form.querySelectorAll('input, textarea, select')).map((el) => {
          const input = el as HTMLInputElement;
          return {
            name: input.name || input.id || '',
            type: input.type || input.tagName.toLowerCase(),
            label: input.labels?.[0]?.textContent?.trim() || input.placeholder || undefined,
            required: input.required
          };
        });

        forms.push({
          selector: form.id ? `#${form.id}` : `form:nth-of-type(${Array.from(document.forms).indexOf(form as HTMLFormElement) + 1})`,
          action: form.action,
          method: form.method,
          inputs
        });
      });

      return forms;
    });
  }

  /**
   * 提取链接
   */
  private async extractLinks(): Promise<LinkElement[]> {
    if (!this.page) throw new Error('页面未初始化');

    return await this.page.evaluate(() => {
      const links: LinkElement[] = [];

      document.querySelectorAll('a[href]').forEach((el, i) => {
        const link = el as HTMLAnchorElement;
        links.push({
          text: link.textContent?.trim() || '',
          href: link.href,
          selector: link.id ? `#${link.id}` : `a:nth-of-type(${i + 1})`
        });
      });

      return links;
    });
  }

  /**
   * 获取当前 URL
   */
  getUrl(): string | null {
    return this.page?.url() || null;
  }

  /**
   * 检查是否已启动
   */
  isRunning(): boolean {
    return this.browser !== null && this.page !== null;
  }
}

export default BrowserAutomation;
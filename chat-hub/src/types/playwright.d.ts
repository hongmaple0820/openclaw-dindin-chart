/**
 * Playwright type declarations
 */
declare module 'playwright' {
  export interface Browser {
    newContext(options?: BrowserContextOptions): Promise<BrowserContext>;
    close(): Promise<void>;
    isConnected(): boolean;
    contexts(): BrowserContext[];
    version(): string;
  }

  export interface BrowserContext {
    newPage(): Promise<Page>;
    close(): Promise<void>;
    pages(): Page[];
  }

  export interface Page {
    goto(url: string, options?: NavigateOptions): Promise<Response | null>;
    content(): Promise<string>;
    title(): Promise<string>;
    url(): string;
    close(): Promise<void>;
    screenshot(options?: ScreenshotOptions): Promise<Buffer>;
    pdf(options?: PDFOptions): Promise<Buffer>;
    evaluate<R>(fn: () => R): Promise<R>;
    waitForSelector(selector: string, options?: WaitForSelectorOptions): Promise<ElementHandle | null>;
    click(selector: string, options?: ClickOptions): Promise<void>;
    fill(selector: string, value: string, options?: FillOptions): Promise<void>;
    type(selector: string, text: string, options?: TypeOptions): Promise<void>;
    $eval<R>(selector: string, fn: (element: Element) => R): Promise<R>;
    $$eval<R>(selector: string, fn: (elements: Element[]) => R): Promise<R>;
    waitForFunction(fn: () => boolean, options?: WaitForFunctionOptions): Promise<JSHandle>;
    setDefaultTimeout(timeout: number): void;
    locator(selector: string): Locator;
    waitForTimeout(timeout: number): Promise<void>;
    $$(selector: string): Promise<ElementHandle[]>;
  }

  export interface ElementHandle {
    click(options?: ClickOptions): Promise<void>;
    fill(value: string, options?: FillOptions): Promise<void>;
    type(text: string, options?: TypeOptions): Promise<void>;
    screenshot(options?: ScreenshotOptions): Promise<Buffer>;
    textContent(): Promise<string | null>;
    innerText(): Promise<string>;
    innerHTML(): Promise<string>;
    getAttribute(name: string): Promise<string | null>;
  }

  export interface Locator {
    click(options?: ClickOptions): Promise<void>;
    fill(value: string, options?: FillOptions): Promise<void>;
    type(text: string, options?: TypeOptions): Promise<void>;
    press(key: string, options?: PressOptions): Promise<void>;
    waitFor(options?: WaitForSelectorOptions): Promise<void>;
    count(): Promise<number>;
    first(): Locator;
    last(): Locator;
    nth(index: number): Locator;
    scrollIntoViewIfNeeded(options?: { timeout?: number }): Promise<void>;
    textContent(): Promise<string | null>;
    innerText(): Promise<string>;
  }

  export interface JSHandle {
    evaluate<R>(fn: (handle: unknown) => R): Promise<R>;
    jsonValue<T = unknown>(): Promise<T>;
  }

  export interface Response {
    url(): string;
    status(): number;
    text(): Promise<string>;
    json(): Promise<unknown>;
  }

  export interface BrowserContextOptions {
    viewport?: { width: number; height: number } | null;
    userAgent?: string;
    locale?: string;
    timezoneId?: string;
  }

  export interface NavigateOptions {
    timeout?: number;
    waitUntil?: 'load' | 'domcontentloaded' | 'networkidle';
  }

  export interface ScreenshotOptions {
    type?: 'png' | 'jpeg';
    path?: string;
    quality?: number;
    fullPage?: boolean;
    clip?: { x: number; y: number; width: number; height: number };
  }

  export interface PDFOptions {
    path?: string;
    scale?: number;
    format?: string;
    printBackground?: boolean;
    margin?: { top?: string; right?: string; bottom?: string; left?: string };
  }

  export interface WaitForSelectorOptions {
    timeout?: number;
    state?: 'attached' | 'detached' | 'visible' | 'hidden';
  }

  export interface ClickOptions {
    button?: 'left' | 'right' | 'middle';
    clickCount?: number;
    delay?: number;
    timeout?: number;
  }

  export interface FillOptions {
    timeout?: number;
  }

  export interface TypeOptions {
    delay?: number;
    timeout?: number;
  }

  export interface PressOptions {
    delay?: number;
    timeout?: number;
  }

  export interface WaitForFunctionOptions {
    timeout?: number;
    polling?: number | 'raf';
  }

  export interface LaunchOptions {
    headless?: boolean;
    executablePath?: string;
    args?: string[];
    timeout?: number;
    devtools?: boolean;
  }

  export interface Playwright {
    chromium: BrowserType;
    firefox: BrowserType;
    webkit: BrowserType;
  }

  export interface BrowserType {
    launch(options?: LaunchOptions): Promise<Browser>;
    connect(options: { wsEndpoint: string }): Promise<Browser>;
    name(): string;
  }

  const playwright: Playwright;
  export default playwright;

  export const chromium: BrowserType;
  export const firefox: BrowserType;
  export const webkit: BrowserType;
}
/**
 * 钉钉通道 API
 */
import express, { type Request, type Response, type NextFunction } from 'express';

const router = express.Router();

interface DingTalkChannel {
  init(): Promise<unknown>;
  sendMessage(to: string, content: unknown, options: Record<string, unknown>): Promise<unknown>;
  sendText(webhook: unknown, text: string, options: { at?: string[]; atAll?: boolean }): Promise<unknown>;
  sendMarkdown(webhook: unknown, data: { title: string; text: string }, options: { at?: string[]; atAll?: boolean }): Promise<unknown>;
  parseWebhook(body: unknown): Promise<unknown>;
  testConnection(webhook?: string): Promise<unknown>;
  getInfo(): unknown;
  webhooks: Record<string, unknown>;
  defaultWebhook?: string;
}

let dingtalkChannel: DingTalkChannel | null = null;

function setChannel(channel: DingTalkChannel): void {
  dingtalkChannel = channel;
}

function ensureChannel(req: Request, res: Response, next: NextFunction): void {
  if (!dingtalkChannel) {
    res.status(500).json({ success: false, error: '钉钉通道未初始化' });
    return;
  }
  next();
}

interface InitBody {
  [key: string]: unknown;
}

interface SendBody {
  to: string;
  content: unknown;
  [key: string]: unknown;
}

interface TextBody {
  text: string;
  webhook?: string;
  at?: string[];
  atAll?: boolean;
}

interface MarkdownBody {
  title: string;
  text: string;
  webhook?: string;
  at?: string[];
  atAll?: boolean;
}

router.post('/init', async (req: Request<object, object, InitBody>, res: Response): Promise<void> => {
  try {
    const DingTalkChannel = require('../plugins/channels/dingtalk-channel');
    dingtalkChannel = new DingTalkChannel(req.body);
    res.json(await dingtalkChannel.init());
  } catch (e) {
    const error = e as Error;
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/send', ensureChannel, async (req: Request<object, object, SendBody>, res: Response): Promise<void> => {
  try {
    const { to, content, ...options } = req.body;
    res.json(await dingtalkChannel!.sendMessage(to, content, options));
  } catch (e) {
    const error = e as Error;
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/text', ensureChannel, async (req: Request<object, object, TextBody>, res: Response): Promise<void> => {
  try {
    const { text, webhook, at, atAll } = req.body;
    const wh = dingtalkChannel!.webhooks[webhook || dingtalkChannel!.defaultWebhook || ''];
    res.json(await dingtalkChannel!.sendText(wh, text, { at, atAll }));
  } catch (e) {
    const error = e as Error;
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/markdown', ensureChannel, async (req: Request<object, object, MarkdownBody>, res: Response): Promise<void> => {
  try {
    const { title, text, webhook, at, atAll } = req.body;
    const wh = dingtalkChannel!.webhooks[webhook || dingtalkChannel!.defaultWebhook || ''];
    res.json(await dingtalkChannel!.sendMarkdown(wh, { title, text }, { at, atAll }));
  } catch (e) {
    const error = e as Error;
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/webhook', async (req: Request, res: Response): Promise<void> => {
  try {
    res.json(await dingtalkChannel!.parseWebhook(req.body));
  } catch (e) {
    const error = e as Error;
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/test', ensureChannel, async (req: Request, res: Response): Promise<void> => {
  try {
    const webhook = req.query.webhook as string | undefined;
    res.json(await dingtalkChannel!.testConnection(webhook));
  } catch (e) {
    const error = e as Error;
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/status', ensureChannel, (req: Request, res: Response): void => {
  res.json({ success: true, data: dingtalkChannel!.getInfo() });
});

export { router, setChannel };
/**
 * MCP Tools Integration Plugin for OpenClaw
 * 
 * 集成热门 MCP 服务功能：
 * - GitHub: 仓库、Issue、PR 操作
 * - SQLite: 本地数据库查询
 * - Sequential Thinking: 思维链推理
 * - 实用工具: JSON、Base64、Hash、UUID、Timestamp
 * 
 * @author maple
 * @version 1.0.0
 */

import { spawn } from "child_process";
import * as path from "path";
import * as fs from "fs";
import * as os from "os";
import * as crypto from "crypto";

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * 展开路径中的 ~ 为用户主目录
 */
function expandPath(p: string): string {
  if (p.startsWith("~/")) {
    return path.join(os.homedir(), p.slice(2));
  }
  return p;
}

/**
 * 执行命令并返回结果
 */
function execCommand(
  command: string,
  args: string[],
  options: { env?: Record<string, string>; timeout?: number } = {}
): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve) => {
    const proc = spawn(command, args, {
      env: { ...process.env, ...options.env },
      timeout: options.timeout || 30000,
    });

    let stdout = "";
    let stderr = "";

    proc.stdout?.on("data", (data) => {
      stdout += data.toString();
    });

    proc.stderr?.on("data", (data) => {
      stderr += data.toString();
    });

    proc.on("close", (code) => {
      resolve({ stdout, stderr, code: code ?? 0 });
    });

    proc.on("error", (err) => {
      resolve({ stdout, stderr: err.message, code: 1 });
    });
  });
}

/**
 * 简单的 SQLite 查询（使用 sqlite3 CLI）
 */
async function querySqlite(
  dbPath: string,
  sql: string
): Promise<{ success: boolean; data?: any[]; error?: string }> {
  const fullPath = expandPath(dbPath);

  // 确保数据库目录存在
  const dir = path.dirname(fullPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const result = await execCommand("sqlite3", ["-json", "-header", fullPath, sql]);

  if (result.code !== 0) {
    return { success: false, error: result.stderr || "Query failed" };
  }

  try {
    const data = result.stdout.trim() ? JSON.parse(result.stdout) : [];
    return { success: true, data };
  } catch {
    // 非 SELECT 语句可能没有 JSON 输出
    return { success: true, data: [], error: result.stdout || "OK" };
  }
}

// ============================================================================
// Plugin Registration
// ============================================================================

export default function register(api: any) {
  const config = api.config?.plugins?.entries?.["mcp-tools"]?.config || {};

  // ==========================================================================
  // SQLite Tools
  // ==========================================================================

  if (config.sqlite?.enabled !== false) {
    const defaultDb = config.sqlite?.defaultDb || "~/.openclaw/data/default.db";

    api.registerTool({
      name: "sqlite_query",
      description: "执行 SQLite 查询。支持 SELECT、INSERT、UPDATE、DELETE 等所有 SQL 语句。",
      parameters: {
        type: "object",
        properties: {
          sql: { type: "string", description: "要执行的 SQL 语句" },
          database: { type: "string", description: "数据库路径，默认使用配置的默认数据库" },
        },
        required: ["sql"],
      },
      async execute(_id: string, params: { sql: string; database?: string }) {
        const dbPath = params.database || defaultDb;
        const result = await querySqlite(dbPath, params.sql);

        if (result.success) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    success: true,
                    database: dbPath,
                    rows: result.data?.length || 0,
                    data: result.data,
                  },
                  null,
                  2
                ),
              },
            ],
          };
        } else {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    success: false,
                    database: dbPath,
                    error: result.error,
                  },
                  null,
                  2
                ),
              },
            ],
            isError: true,
          };
        }
      },
    });

    api.registerTool({
      name: "sqlite_schema",
      description: "获取 SQLite 数据库的表结构信息",
      parameters: {
        type: "object",
        properties: {
          database: { type: "string", description: "数据库路径" },
          table: { type: "string", description: "指定表名，不指定则列出所有表" },
        },
        required: [],
      },
      async execute(_id: string, params: { database?: string; table?: string }) {
        const dbPath = params.database || defaultDb;

        if (params.table) {
          const result = await querySqlite(dbPath, `PRAGMA table_info(${params.table})`);
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    success: result.success,
                    database: dbPath,
                    table: params.table,
                    columns: result.data,
                  },
                  null,
                  2
                ),
              },
            ],
          };
        } else {
          const result = await querySqlite(
            dbPath,
            "SELECT name, type FROM sqlite_master WHERE type IN ('table', 'view') ORDER BY name"
          );
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    success: result.success,
                    database: dbPath,
                    tables: result.data,
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }
      },
    });
  }

  // ==========================================================================
  // GitHub Tools
  // ==========================================================================

  if (config.github?.enabled && config.github?.token) {
    const githubToken = config.github.token;

    api.registerTool(
      {
        name: "github_search",
        description: "搜索 GitHub 仓库、代码、Issue 或用户",
        parameters: {
          type: "object",
          properties: {
            query: { type: "string", description: "搜索关键词" },
            type: {
              type: "string",
              enum: ["repositories", "code", "issues", "users"],
              default: "repositories",
              description: "搜索类型",
            },
            limit: { type: "number", default: 10, description: "返回结果数量" },
          },
          required: ["query"],
        },
        async execute(
          _id: string,
          params: { query: string; type?: string; limit?: number }
        ) {
          const searchType = params.type || "repositories";
          const limit = params.limit || 10;

          const result = await execCommand("curl", [
            "-s",
            "-H",
            `Authorization: Bearer ${githubToken}`,
            "-H",
            "Accept: application/vnd.github.v3+json",
            `https://api.github.com/search/${searchType}?q=${encodeURIComponent(params.query)}&per_page=${limit}`,
          ]);

          if (result.code !== 0) {
            return {
              content: [{ type: "text", text: `Error: ${result.stderr}` }],
              isError: true,
            };
          }

          try {
            const data = JSON.parse(result.stdout);
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(
                    {
                      total_count: data.total_count,
                      items: data.items?.slice(0, limit).map((item: any) => ({
                        name: item.full_name || item.name || item.login,
                        description: item.description,
                        url: item.html_url,
                        stars: item.stargazers_count,
                      })),
                    },
                    null,
                    2
                  ),
                },
              ],
            };
          } catch (e) {
            return {
              content: [{ type: "text", text: `Parse error: ${result.stdout}` }],
              isError: true,
            };
          }
        },
      },
      { optional: true }
    );

    api.registerTool(
      {
        name: "github_repo_info",
        description: "获取 GitHub 仓库详细信息",
        parameters: {
          type: "object",
          properties: {
            owner: { type: "string", description: "仓库所有者" },
            repo: { type: "string", description: "仓库名称" },
          },
          required: ["owner", "repo"],
        },
        async execute(_id: string, params: { owner: string; repo: string }) {
          const result = await execCommand("curl", [
            "-s",
            "-H",
            `Authorization: Bearer ${githubToken}`,
            "-H",
            "Accept: application/vnd.github.v3+json",
            `https://api.github.com/repos/${params.owner}/${params.repo}`,
          ]);

          if (result.code !== 0) {
            return {
              content: [{ type: "text", text: `Error: ${result.stderr}` }],
              isError: true,
            };
          }

          try {
            const repo = JSON.parse(result.stdout);
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(
                    {
                      name: repo.full_name,
                      description: repo.description,
                      url: repo.html_url,
                      stars: repo.stargazers_count,
                      forks: repo.forks_count,
                      language: repo.language,
                      topics: repo.topics,
                      created_at: repo.created_at,
                      updated_at: repo.updated_at,
                      open_issues: repo.open_issues_count,
                    },
                    null,
                    2
                  ),
                },
              ],
            };
          } catch (e) {
            return {
              content: [{ type: "text", text: `Parse error: ${result.stdout}` }],
              isError: true,
            };
          }
        },
      },
      { optional: true }
    );

    api.registerTool(
      {
        name: "github_issues",
        description: "列出 GitHub 仓库的 Issues",
        parameters: {
          type: "object",
          properties: {
            owner: { type: "string", description: "仓库所有者" },
            repo: { type: "string", description: "仓库名称" },
            state: { type: "string", enum: ["open", "closed", "all"], default: "open" },
            limit: { type: "number", default: 10 },
          },
          required: ["owner", "repo"],
        },
        async execute(
          _id: string,
          params: { owner: string; repo: string; state?: string; limit?: number }
        ) {
          const state = params.state || "open";
          const limit = params.limit || 10;

          const result = await execCommand("curl", [
            "-s",
            "-H",
            `Authorization: Bearer ${githubToken}`,
            "-H",
            "Accept: application/vnd.github.v3+json",
            `https://api.github.com/repos/${params.owner}/${params.repo}/issues?state=${state}&per_page=${limit}`,
          ]);

          if (result.code !== 0) {
            return {
              content: [{ type: "text", text: `Error: ${result.stderr}` }],
              isError: true,
            };
          }

          try {
            const issues = JSON.parse(result.stdout);
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(
                    {
                      count: issues.length,
                      issues: issues.map((issue: any) => ({
                        number: issue.number,
                        title: issue.title,
                        state: issue.state,
                        author: issue.user?.login,
                        created_at: issue.created_at,
                        url: issue.html_url,
                      })),
                    },
                    null,
                    2
                  ),
                },
              ],
            };
          } catch (e) {
            return {
              content: [{ type: "text", text: `Parse error: ${result.stdout}` }],
              isError: true,
            };
          }
        },
      },
      { optional: true }
    );
  }

  // ==========================================================================
  // Sequential Thinking Tool
  // ==========================================================================

  if (config.sequentialThinking?.enabled !== false) {
    api.registerTool({
      name: "think",
      description:
        "结构化思考工具。用于分解复杂问题，按步骤推理。每次调用记录一个思考步骤，可以多次调用形成完整的思维链。",
      parameters: {
        type: "object",
        properties: {
          thought: { type: "string", description: "当前的思考内容" },
          thoughtNumber: { type: "number", description: "当前是第几步思考" },
          totalThoughts: { type: "number", description: "预计总共需要多少步思考" },
          nextThoughtNeeded: { type: "boolean", description: "是否还需要继续思考" },
          isRevision: { type: "boolean", description: "是否是对之前思考的修正" },
          revisesThought: { type: "number", description: "修正的是第几步思考" },
          branchFromThought: { type: "number", description: "从第几步思考分支" },
          branchId: { type: "string", description: "分支标识" },
        },
        required: ["thought", "thoughtNumber", "totalThoughts", "nextThoughtNeeded"],
      },
      async execute(
        _id: string,
        params: {
          thought: string;
          thoughtNumber: number;
          totalThoughts: number;
          nextThoughtNeeded: boolean;
          isRevision?: boolean;
          revisesThought?: number;
          branchFromThought?: number;
          branchId?: string;
        }
      ) {
        const prefix = params.isRevision
          ? `🔄 [修正思考 #${params.revisesThought}]`
          : params.branchFromThought
            ? `🌿 [分支 ${params.branchId} from #${params.branchFromThought}]`
            : `💭 [思考 ${params.thoughtNumber}/${params.totalThoughts}]`;

        const result = {
          step: params.thoughtNumber,
          total: params.totalThoughts,
          thought: params.thought,
          needMore: params.nextThoughtNeeded,
          isRevision: params.isRevision || false,
          isBranch: !!params.branchFromThought,
        };

        return {
          content: [
            {
              type: "text",
              text: `${prefix}\n\n${params.thought}\n\n---\n${params.nextThoughtNeeded ? "继续思考..." : "思考完成 ✅"}\n\n${JSON.stringify(result, null, 2)}`,
            },
          ],
        };
      },
    });
  }

  // ==========================================================================
  // Utility Tools
  // ==========================================================================

  // JSON 处理工具
  api.registerTool({
    name: "json_parse",
    description: "解析 JSON 字符串并格式化输出，支持 JSONPath 查询",
    parameters: {
      type: "object",
      properties: {
        json: { type: "string", description: "JSON 字符串" },
        path: { type: "string", description: "JSONPath 表达式，如 $.data[0].name" },
      },
      required: ["json"],
    },
    async execute(_id: string, params: { json: string; path?: string }) {
      try {
        const data = JSON.parse(params.json);

        if (params.path) {
          // 简单的 JSONPath 实现
          const pathParts = params.path
            .replace(/^\$\.?/, "")
            .split(/\.|\[|\]/)
            .filter(Boolean);
          let result: any = data;
          for (const part of pathParts) {
            if (result === undefined) break;
            result = result[part];
          }
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({ path: params.path, result }, null, 2),
              },
            ],
          };
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(data, null, 2),
            },
          ],
        };
      } catch (e: any) {
        return {
          content: [{ type: "text", text: `JSON Parse Error: ${e.message}` }],
          isError: true,
        };
      }
    },
  });

  // Base64 编解码
  api.registerTool({
    name: "base64",
    description: "Base64 编码或解码",
    parameters: {
      type: "object",
      properties: {
        input: { type: "string", description: "输入内容" },
        action: { type: "string", enum: ["encode", "decode"], description: "操作类型" },
      },
      required: ["input", "action"],
    },
    async execute(_id: string, params: { input: string; action: "encode" | "decode" }) {
      try {
        if (params.action === "encode") {
          const result = Buffer.from(params.input).toString("base64");
          return {
            content: [{ type: "text", text: result }],
          };
        } else {
          const result = Buffer.from(params.input, "base64").toString("utf-8");
          return {
            content: [{ type: "text", text: result }],
          };
        }
      } catch (e: any) {
        return {
          content: [{ type: "text", text: `Error: ${e.message}` }],
          isError: true,
        };
      }
    },
  });

  // Hash 计算
  api.registerTool({
    name: "hash",
    description: "计算字符串的哈希值",
    parameters: {
      type: "object",
      properties: {
        input: { type: "string", description: "输入内容" },
        algorithm: {
          type: "string",
          enum: ["md5", "sha1", "sha256", "sha512"],
          default: "sha256",
        },
      },
      required: ["input"],
    },
    async execute(_id: string, params: { input: string; algorithm?: string }) {
      const algo = params.algorithm || "sha256";
      const hash = crypto.createHash(algo).update(params.input).digest("hex");
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ algorithm: algo, hash }, null, 2),
          },
        ],
      };
    },
  });

  // UUID 生成
  api.registerTool({
    name: "uuid",
    description: "生成 UUID",
    parameters: {
      type: "object",
      properties: {
        count: { type: "number", default: 1, description: "生成数量" },
      },
      required: [],
    },
    async execute(_id: string, params: { count?: number }) {
      const count = Math.min(params.count || 1, 100);
      const uuids = Array.from({ length: count }, () => crypto.randomUUID());
      return {
        content: [
          {
            type: "text",
            text: count === 1 ? uuids[0] : JSON.stringify(uuids, null, 2),
          },
        ],
      };
    },
  });

  // 时间工具
  api.registerTool({
    name: "timestamp",
    description: "时间戳转换工具",
    parameters: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["now", "to_date", "to_timestamp"] },
        value: { type: "string", description: "时间戳或日期字符串" },
        timezone: { type: "string", default: "Asia/Shanghai" },
      },
      required: ["action"],
    },
    async execute(
      _id: string,
      params: { action: string; value?: string; timezone?: string }
    ) {
      const tz = params.timezone || "Asia/Shanghai";

      if (params.action === "now") {
        const now = new Date();
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  timestamp: now.getTime(),
                  timestampSeconds: Math.floor(now.getTime() / 1000),
                  iso: now.toISOString(),
                  local: now.toLocaleString("zh-CN", { timeZone: tz }),
                },
                null,
                2
              ),
            },
          ],
        };
      } else if (params.action === "to_date" && params.value) {
        const ts = parseInt(params.value);
        const date = new Date(ts > 9999999999 ? ts : ts * 1000);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  timestamp: ts,
                  iso: date.toISOString(),
                  local: date.toLocaleString("zh-CN", { timeZone: tz }),
                },
                null,
                2
              ),
            },
          ],
        };
      } else if (params.action === "to_timestamp" && params.value) {
        const date = new Date(params.value);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  input: params.value,
                  timestamp: date.getTime(),
                  timestampSeconds: Math.floor(date.getTime() / 1000),
                },
                null,
                2
              ),
            },
          ],
        };
      }

      return {
        content: [{ type: "text", text: "Invalid action or missing value" }],
        isError: true,
      };
    },
  });

  console.log("[mcp-tools] Plugin loaded successfully");
  console.log(
    "[mcp-tools] SQLite tools:",
    config.sqlite?.enabled !== false ? "enabled" : "disabled"
  );
  console.log("[mcp-tools] GitHub tools:", config.github?.enabled ? "enabled" : "disabled");
  console.log(
    "[mcp-tools] Sequential Thinking:",
    config.sequentialThinking?.enabled !== false ? "enabled" : "disabled"
  );
}

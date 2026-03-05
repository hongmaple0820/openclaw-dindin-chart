/**
 * Database Wrapper for better-sqlite3
 * Adapts synchronous better-sqlite3 API to async-style API
 */

import type Database from 'better-sqlite3';

interface RunResult {
  changes: number;
  lastInsertRowid: number | bigint;
}

interface DbWrapperConfig {
  db: Database.Database;
}

class DbWrapper {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  /**
   * Run a query that doesn't return results
   */
  async run(sql: string, params: unknown[] = []): Promise<RunResult> {
    try {
      const stmt = this.db.prepare(sql);
      const result = stmt.run(...params);
      return {
        changes: result.changes,
        lastInsertRowid: result.lastInsertRowid
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get a single row
   */
  async get<T = unknown>(sql: string, params: unknown[] = []): Promise<T | null> {
    try {
      const stmt = this.db.prepare(sql);
      return (stmt.get(...params) as T) || null;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get all rows
   */
  async all<T = unknown>(sql: string, params: unknown[] = []): Promise<T[]> {
    try {
      const stmt = this.db.prepare(sql);
      return stmt.all(...params) as T[];
    } catch (error) {
      throw error;
    }
  }

  /**
   * Execute raw SQL (for migrations, etc.)
   */
  async exec(sql: string): Promise<void> {
    try {
      this.db.exec(sql);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Prepare a statement (returns native better-sqlite3 statement)
   */
  prepare(sql: string): Database.Statement {
    return this.db.prepare(sql);
  }

  /**
   * Close the database
   */
  close(): void {
    this.db.close();
  }
}

export default DbWrapper;
export type { RunResult, DbWrapperConfig };
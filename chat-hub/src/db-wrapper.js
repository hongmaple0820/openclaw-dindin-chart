/**
 * Database Wrapper for better-sqlite3
 * Adapts synchronous better-sqlite3 API to async-style API
 */

class DbWrapper {
  constructor(db) {
    this.db = db;
  }

  /**
   * Run a query that doesn't return results
   * @param {string} sql - SQL query
   * @param {Array} params - Parameters
   * @returns {Promise<{changes: number, lastInsertRowid: number}>}
   */
  async run(sql, params = []) {
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
   * @param {string} sql - SQL query
   * @param {Array} params - Parameters
   * @returns {Promise<Object|null>}
   */
  async get(sql, params = []) {
    try {
      const stmt = this.db.prepare(sql);
      return stmt.get(...params) || null;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get all rows
   * @param {string} sql - SQL query
   * @param {Array} params - Parameters
   * @returns {Promise<Array>}
   */
  async all(sql, params = []) {
    try {
      const stmt = this.db.prepare(sql);
      return stmt.all(...params);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Execute raw SQL (for migrations, etc.)
   * @param {string} sql - SQL to execute
   * @returns {Promise<void>}
   */
  async exec(sql) {
    try {
      this.db.exec(sql);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Prepare a statement (returns native better-sqlite3 statement)
   * @param {string} sql - SQL query
   * @returns {Object} better-sqlite3 statement
   */
  prepare(sql) {
    return this.db.prepare(sql);
  }

  /**
   * Close the database
   */
  close() {
    this.db.close();
  }
}

module.exports = DbWrapper;
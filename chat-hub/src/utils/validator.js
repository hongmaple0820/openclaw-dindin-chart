/**
 * 输入验证工具
 * 统一的参数验证，防止注入攻击
 * @author 小琳
 * @date 2026-02-06
 */

class ValidationError extends Error {
  constructor(message, field = null) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
    this.statusCode = 400;
  }
}

/**
 * 验证消息内容
 */
function validateMessage(data) {
  const { content, sender } = data;

  if (!content || typeof content !== 'string') {
    throw new ValidationError('content is required and must be a string', 'content');
  }

  if (content.trim().length === 0) {
    throw new ValidationError('content cannot be empty', 'content');
  }

  if (content.length > 10000) {
    throw new ValidationError('content too long (max 10000 characters)', 'content');
  }

  if (sender && typeof sender !== 'string') {
    throw new ValidationError('sender must be a string', 'sender');
  }

  if (sender && sender.length > 100) {
    throw new ValidationError('sender name too long (max 100 characters)', 'sender');
  }

  // 防止 XSS
  const dangerousPatterns = [/<script/i, /javascript:/i, /onerror=/i, /onclick=/i];
  if (dangerousPatterns.some(pattern => pattern.test(content))) {
    throw new ValidationError('content contains potentially dangerous code', 'content');
  }

  return true;
}

/**
 * 验证分页参数
 */
function validatePagination(query) {
  const page = parseInt(query.page) || 1;
  const limit = parseInt(query.limit) || 50;

  if (page < 1) {
    throw new ValidationError('page must be >= 1', 'page');
  }

  if (limit < 1 || limit > 200) {
    throw new ValidationError('limit must be between 1 and 200', 'limit');
  }

  return { page, limit };
}

/**
 * 验证搜索关键词
 */
function validateSearchQuery(query) {
  if (!query || typeof query !== 'string') {
    throw new ValidationError('search query is required', 'q');
  }

  if (query.length < 1) {
    throw new ValidationError('search query too short', 'q');
  }

  if (query.length > 200) {
    throw new ValidationError('search query too long (max 200 characters)', 'q');
  }

  return query.trim();
}

/**
 * 验证 ID
 */
function validateId(id, fieldName = 'id') {
  if (!id || typeof id !== 'string') {
    throw new ValidationError(`${fieldName} is required and must be a string`, fieldName);
  }

  if (id.length > 200) {
    throw new ValidationError(`${fieldName} too long`, fieldName);
  }

  // 防止路径遍历
  if (id.includes('..') || id.includes('/') || id.includes('\\')) {
    throw new ValidationError(`${fieldName} contains invalid characters`, fieldName);
  }

  return id;
}

/**
 * 验证时间戳
 */
function validateTimestamp(timestamp, fieldName = 'timestamp') {
  const ts = parseInt(timestamp);

  if (isNaN(ts)) {
    throw new ValidationError(`${fieldName} must be a valid number`, fieldName);
  }

  if (ts < 0 || ts > Date.now() + 86400000) { // 不能超过未来24小时
    throw new ValidationError(`${fieldName} is out of valid range`, fieldName);
  }

  return ts;
}

/**
 * 清理 SQL 输入（额外保护）
 */
function sanitizeSql(input) {
  if (typeof input !== 'string') return input;

  // 移除潜在的 SQL 注入字符
  return input.replace(/['";\\]/g, '');
}

module.exports = {
  ValidationError,
  validateMessage,
  validatePagination,
  validateSearchQuery,
  validateId,
  validateTimestamp,
  sanitizeSql
};

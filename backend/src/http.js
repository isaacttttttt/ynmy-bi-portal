import { searchCategories } from '../../src/lib/portal-model.ts';

export class ApiError extends Error {
  constructor(statusCode, code, message) { super(message); this.statusCode = statusCode; this.code = code; }
}
export const invalid = () => new ApiError(400, 'INVALID_REQUEST', '请求参数不合法');
export function pageQuery(query, { reports = false, workbench = false, defaultSize = 6 } = {}) {
  const allowed = ['page', 'pageSize', ...(reports ? ['q', 'category', 'organization', 'status', 'permission', 'frequency', 'volume'] : []), ...(workbench ? ['tab'] : [])];
  if (Object.keys(query).some(key => !allowed.includes(key))) throw invalid();
  const positive = (value, fallback, max) => {
    if (value === undefined) return fallback;
    if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) > max) throw invalid();
    return Number(value);
  };
  const result = { page: positive(query.page, 1, 1000000), pageSize: positive(query.pageSize, defaultSize, 100) };
  if (reports) {
    if (query.q !== undefined && (typeof query.q !== 'string' || query.q.length > 200)) throw invalid();
    result.q = (query.q || '').trim(); result.filters = {};
    result.category = searchCategory(query.category);
    const enums = { permission: ['granted'], status: ['active', 'archived'], frequency: ['实时', 'T+1', '周更新', '月更新'], volume: ['high', 'medium', 'low'] };
    for (const key of ['organization', 'status', 'permission', 'frequency', 'volume']) {
      const values = query[key] === undefined ? [] : Array.isArray(query[key]) ? query[key] : [query[key]];
      if (values.length > 20 || values.some(v => typeof v !== 'string' || !v || v.length > 100 || (enums[key] && !enums[key].includes(v)))) throw invalid();
      result.filters[key] = [...new Set(values)];
    }
  }
  if (workbench) {
    if (!['recent', 'frequent', 'favorites'].includes(query.tab)) throw invalid();
    result.tab = query.tab;
  }
  return result;
}
export function searchCategory(value = 'all') {
  if (!searchCategories.includes(value)) throw invalid();
  return value;
}
export function searchQuery(query, withText = false) {
  if (Object.keys(query).some(key => !['category', ...(withText ? ['q'] : [])].includes(key))) throw invalid();
  if (query.q !== undefined && (typeof query.q !== 'string' || query.q.length > 200)) throw invalid();
  return { category: searchCategory(query.category), q: (query.q || '').trim() };
}
export function requireOrigin(request, origin) {
  if (request.headers.origin !== origin || request.headers['sec-fetch-site'] === 'cross-site') throw new ApiError(403, 'INVALID_ORIGIN', '请求来源不允许');
}
export function cookieToken(request) {
  const values = (request.headers.cookie || '').split(';').map(v => v.trim()).filter(v => v.startsWith('fine_auth_token='));
  if (values.length !== 1) throw new ApiError(401, 'SESSION_EXPIRED', '登录已过期，请重新登录');
  let token;
  try { token = decodeURIComponent(values[0].slice('fine_auth_token='.length)); } catch { throw invalid(); }
  if (!/^[\x21-\x7e]{1,4096}$/.test(token)) throw invalid();
  return token;
}
export function publicUrl(value) {
  if (!value) return null;
  try {
    const url = new URL(value, 'https://portal.invalid');
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? value : null;
  } catch { return null; }
}
export function businessDate() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); }

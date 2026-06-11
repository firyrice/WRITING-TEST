export function uuid(): string {
  // 在 modern 浏览器和 jsdom 里 crypto.randomUUID 都可用
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

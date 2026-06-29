/**
 * Normalize Trimble Connect file path fields to a readable string.
 * The API may return parentPath as a string, array of segments, or object.
 */
export function normalizeFilePath(value: unknown): string {
  if (!value) return '/';
  if (typeof value === 'string') return value.replace(/\\/g, '/');

  if (Array.isArray(value)) {
    const segments = value
      .map((seg) => {
        if (typeof seg === 'string') return seg;
        if (seg && typeof seg === 'object') {
          const obj = seg as Record<string, unknown>;
          return String(obj.name || obj.label || obj.nm || '');
        }
        return '';
      })
      .filter(Boolean);
    return segments.length ? `/${segments.join('/')}` : '/';
  }

  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if (typeof obj.path === 'string') return normalizeFilePath(obj.path);
    if (typeof obj.fullPath === 'string') return normalizeFilePath(obj.fullPath);
    if (typeof obj.name === 'string' && !obj.path) return `/${obj.name}`;
    if (Array.isArray(obj.segments)) return normalizeFilePath(obj.segments);
  }

  return '/';
}

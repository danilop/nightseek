import { getCached, setCache } from '@/lib/utils/cache';

const pending = new Map<string, Promise<unknown>>();
/** Cache only successful responses; deduplicate concurrent mounts and bound network waits. */
export async function publicData<T>(
  key: string,
  ttl: number,
  url: string,
  parse: (raw: unknown) => T,
  options: { parseNoContent?: () => T } = {}
): Promise<T | null> {
  const fullKey = `nightseek:public:v1:${key}`;
  const cached = await getCached<T>(fullKey, ttl);
  if (cached !== null) return cached;
  const existing = pending.get(fullKey);
  if (existing) return existing as Promise<T | null>;
  const request = (async () => {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(20_000) });
      if (!response.ok) return null;
      const result =
        response.status === 204 && options.parseNoContent
          ? options.parseNoContent()
          : parse(await response.json());
      await setCache(fullKey, result);
      return result;
    } catch {
      return null;
    } finally {
      pending.delete(fullKey);
    }
  })();
  pending.set(fullKey, request);
  return request;
}
export function numeric(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}
export function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Invalid source schema');
  return value as Record<string, unknown>;
}

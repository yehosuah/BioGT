import { trackMapMetric } from "@/features/map/performance/mapMetrics";

type CacheEntry<TValue> = {
  expiresAt: number;
  value: TValue;
};

type CacheLoadOptions = {
  forceRefresh?: boolean;
  ttlMs?: number;
};

const DEFAULT_TTL_MS = 60_000;

const stableStringify = (value: unknown): string => {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(",")}]`;
  }

  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entryValue]) => `${JSON.stringify(key)}:${stableStringify(entryValue)}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
};

export const createMapCacheKey = (...parts: unknown[]) => stableStringify(parts);

export class MapDataCache<TValue = unknown> {
  private readonly entries = new Map<string, CacheEntry<TValue>>();
  private readonly inflight = new Map<string, Promise<TValue>>();

  async getOrLoad(
    key: string,
    loader: () => Promise<TValue>,
    options: CacheLoadOptions = {}
  ): Promise<TValue> {
    const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
    const now = Date.now();
    const cached = this.entries.get(key);

    if (!options.forceRefresh && cached && cached.expiresAt > now) {
      trackMapMetric("cache_hit", { key });
      return cached.value;
    }

    if (!options.forceRefresh) {
      const existingPromise = this.inflight.get(key);
      if (existingPromise) {
        trackMapMetric("cache_hit", { key, source: "inflight" });
        return existingPromise;
      }
    }

    trackMapMetric("cache_miss", { key, forceRefresh: Boolean(options.forceRefresh) });

    const promise = loader()
      .then((value) => {
        this.entries.set(key, {
          value,
          expiresAt: Date.now() + ttlMs
        });
        this.inflight.delete(key);
        return value;
      })
      .catch((error) => {
        this.inflight.delete(key);
        throw error;
      });

    this.inflight.set(key, promise);
    return promise;
  }

  peek(key: string) {
    const cached = this.entries.get(key);
    if (!cached || cached.expiresAt <= Date.now()) {
      this.entries.delete(key);
      return undefined;
    }

    return cached.value;
  }

  invalidate(key: string) {
    this.entries.delete(key);
    this.inflight.delete(key);
  }

  clear() {
    this.entries.clear();
    this.inflight.clear();
  }
}

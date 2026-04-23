import { describe, expect, it, vi } from "vitest";

import { MapDataCache, createMapCacheKey } from "@/features/map/performance/mapCache";

describe("MapDataCache", () => {
  it("returns cached values on cache hit", async () => {
    const cache = new MapDataCache<string>();
    const loader = vi.fn(async () => "cached");

    await cache.getOrLoad("alpha", loader, { ttlMs: 1_000 });
    const result = await cache.getOrLoad("alpha", loader, { ttlMs: 1_000 });

    expect(result).toBe("cached");
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("expires entries after ttl", async () => {
    vi.useFakeTimers();
    const cache = new MapDataCache<string>();
    const loader = vi.fn(async () => "next");

    await cache.getOrLoad("alpha", loader, { ttlMs: 100 });
    vi.advanceTimersByTime(150);
    await cache.getOrLoad("alpha", loader, { ttlMs: 100 });

    expect(loader).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it("deduplicates in-flight loads", async () => {
    let resolveLoader!: (value: string) => void;
    const cache = new MapDataCache<string>();
    const loader = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          resolveLoader = resolve;
        })
    );

    const first = cache.getOrLoad("alpha", loader);
    const second = cache.getOrLoad("alpha", loader);
    resolveLoader("shared");

    await expect(first).resolves.toBe("shared");
    await expect(second).resolves.toBe("shared");
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("supports forced refresh", async () => {
    const cache = new MapDataCache<string>();
    const loader = vi
      .fn<() => Promise<string>>()
      .mockResolvedValueOnce("first")
      .mockResolvedValueOnce("second");

    await cache.getOrLoad("alpha", loader);
    const refreshed = await cache.getOrLoad("alpha", loader, { forceRefresh: true });

    expect(refreshed).toBe("second");
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it("builds stable cache keys", () => {
    expect(createMapCacheKey("layer", { b: 2, a: 1 })).toBe(
      createMapCacheKey("layer", { a: 1, b: 2 })
    );
  });
});

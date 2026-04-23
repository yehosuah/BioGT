import { describe, expect, it, vi } from "vitest";

import {
  createDebouncedCallback,
  createThrottledCallback
} from "@/features/map/performance/eventRate";

describe("eventRate", () => {
  it("debounces repeated callbacks", () => {
    vi.useFakeTimers();
    const callback = vi.fn();
    const debounced = createDebouncedCallback(callback, 200);

    debounced("a");
    debounced("b");
    vi.advanceTimersByTime(199);
    expect(callback).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith("b");
    vi.useRealTimers();
  });

  it("cancels debounced callbacks", () => {
    vi.useFakeTimers();
    const callback = vi.fn();
    const debounced = createDebouncedCallback(callback, 200);

    debounced("a");
    debounced.cancel();
    vi.advanceTimersByTime(250);

    expect(callback).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("throttles viewport callbacks", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-18T00:00:00Z"));
    const callback = vi.fn();
    const throttled = createThrottledCallback(callback, 100);

    throttled("a");
    throttled("b");
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenLastCalledWith("a");

    vi.advanceTimersByTime(100);
    expect(callback).toHaveBeenCalledTimes(2);
    expect(callback).toHaveBeenLastCalledWith("b");
    vi.useRealTimers();
  });
});

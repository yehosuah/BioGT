import { describe, expect, it } from "vitest";

import { sanitizeForLog } from "@/observability/logger";

describe("sanitizeForLog", () => {
  it("redacts mapbox tokens", () => {
    const value = sanitizeForLog("token pk.abcdefghijklmnopqrstuvwxyz123456 secret");

    expect(value).not.toContain("pk.abcdefghijklmnopqrstuvwxyz123456");
    expect(value).toContain("[REDACTED]");
  });

  it("redacts google maps keys", () => {
    const value = sanitizeForLog("AIzaSyA-very-real-looking-google-key-123456789");

    expect(value).not.toContain("AIza");
    expect(value).toContain("[REDACTED]");
  });

  it("redacts token query params", () => {
    const value = sanitizeForLog(
      "https://example.com/tiles?access_token=abc123&api_key=xyz789&token=secret"
    );

    expect(value).not.toContain("abc123");
    expect(value).not.toContain("xyz789");
    expect(value).not.toContain("secret");
    expect(value).toContain("access_token=[REDACTED]");
  });

  it("does not mutate normal messages", () => {
    expect(sanitizeForLog("map loaded")).toBe("map loaded");
  });
});

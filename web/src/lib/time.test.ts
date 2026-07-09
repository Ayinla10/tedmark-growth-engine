import { describe, expect, it } from "vitest";
import { formatDate, isRecent, timeAgo } from "./time";

describe("timeAgo", () => {
  it("returns 'never' for null", () => {
    expect(timeAgo(null)).toBe("never");
  });

  it("returns 'just now' for sub-minute timestamps", () => {
    expect(timeAgo(new Date(Date.now() - 5_000).toISOString())).toBe("just now");
  });

  it("formats minutes, hours, and days correctly", () => {
    expect(timeAgo(new Date(Date.now() - 5 * 60_000).toISOString())).toBe("5m ago");
    expect(timeAgo(new Date(Date.now() - 3 * 3_600_000).toISOString())).toBe("3h ago");
    expect(timeAgo(new Date(Date.now() - 2 * 86_400_000).toISOString())).toBe("2d ago");
  });
});

describe("isRecent", () => {
  it("is false for null", () => {
    expect(isRecent(null)).toBe(false);
  });

  it("is true within the default 24h window and false just outside it", () => {
    expect(isRecent(new Date(Date.now() - 23 * 3_600_000).toISOString())).toBe(true);
    expect(isRecent(new Date(Date.now() - 25 * 3_600_000).toISOString())).toBe(false);
  });

  it("respects a custom hours window", () => {
    expect(isRecent(new Date(Date.now() - 30 * 60_000).toISOString(), 1)).toBe(true);
    expect(isRecent(new Date(Date.now() - 90 * 60_000).toISOString(), 1)).toBe(false);
  });
});

describe("formatDate", () => {
  it("returns an em dash for null", () => {
    expect(formatDate(null)).toBe("—");
  });

  it("formats a date in en-GB day/month/year style", () => {
    // Pin the timezone-sensitive formatting by using a UTC-noon timestamp.
    expect(formatDate("2026-03-05T12:00:00.000Z")).toBe("5 Mar 2026");
  });
});

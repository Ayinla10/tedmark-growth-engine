import { describe, expect, it, beforeAll } from "vitest";
import { createSession, verifySessionToken } from "./auth";

beforeAll(() => {
  process.env.AUTH_SECRET = "test-secret-not-for-production-use-only";
});

describe("session token round trip", () => {
  const user = { id: "u1", email: "tedai@gmail.com", name: "Tedmark Admin", role: "admin" };

  it("signs a token that verifies back to the same user", async () => {
    const token = await createSession(user);
    const verified = await verifySessionToken(token);
    expect(verified).toEqual(user);
  });

  it("rejects a garbage token", async () => {
    expect(await verifySessionToken("not-a-real-jwt")).toBeNull();
  });

  it("rejects a token signed with a different secret", async () => {
    const token = await createSession(user);
    const originalSecret = process.env.AUTH_SECRET;
    process.env.AUTH_SECRET = "a-completely-different-secret-value";
    expect(await verifySessionToken(token)).toBeNull();
    process.env.AUTH_SECRET = originalSecret;
  });
});

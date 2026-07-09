import { describe, expect, it } from "vitest";
import { dateClause } from "./queries";

describe("dateClause", () => {
  it("returns an empty clause when no range is given", () => {
    const params: unknown[] = [];
    expect(dateClause("created_at", undefined, params)).toBe("");
    expect(params).toEqual([]);
  });

  it("returns an empty clause for an empty range object", () => {
    const params: unknown[] = [];
    expect(dateClause("created_at", {}, params)).toBe("");
    expect(params).toEqual([]);
  });

  it("builds a >= clause for a from-only range, appending to params", () => {
    const params: unknown[] = ["existing"];
    const clause = dateClause("created_at", { from: "2026-01-01" }, params);
    expect(clause).toBe(" AND created_at >= $2");
    expect(params).toEqual(["existing", "2026-01-01"]);
  });

  it("builds a <= clause for a to-only range, padding to end-of-day", () => {
    const params: unknown[] = [];
    const clause = dateClause("created_at", { to: "2026-01-31" }, params);
    expect(clause).toBe(" AND created_at <= $1");
    expect(params).toEqual(["2026-01-31 23:59:59"]);
  });

  it("builds both clauses joined with AND when from and to are both given", () => {
    const params: unknown[] = [];
    const clause = dateClause("created_at", { from: "2026-01-01", to: "2026-01-31" }, params);
    expect(clause).toBe(" AND created_at >= $1 AND created_at <= $2");
    expect(params).toEqual(["2026-01-01", "2026-01-31 23:59:59"]);
  });
});

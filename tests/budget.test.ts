import { expect, test } from "vite-plus/test";
import { checkBudget } from "../src/budget.ts";
import type { BuildSummary } from "../src/types.ts";

function makeSummary(overrides: Partial<BuildSummary> = {}): BuildSummary {
  return {
    timing: { total: 1000 },
    assets: [
      { name: "a.js", type: "js", size: 100, gzip: 30, brotli: 25 },
      { name: "b.js", type: "js", size: 500, gzip: 150, brotli: 140 },
    ],
    totalSize: 600,
    totalGzip: 180,
    totalBrotli: 165,
    ...overrides,
  };
}

test("checkBudget passes when under limits", () => {
  const result = checkBudget(makeSummary(), { totalSize: 1000 });
  expect(result.exceeded).toBe(false);
  expect(result.messages).toHaveLength(0);
  expect(result.violations).toHaveLength(0);
});

test("checkBudget flags totalSize over budget", () => {
  const result = checkBudget(makeSummary(), { totalSize: 500 });
  expect(result.exceeded).toBe(true);
  expect(result.messages[0]).toContain("总大小");
});

test("checkBudget flags totalGzip over budget", () => {
  const result = checkBudget(makeSummary(), { totalGzip: 100 });
  expect(result.exceeded).toBe(true);
  expect(result.messages[0]).toContain("总 gzip");
});

test("checkBudget flags per-chunk over budget", () => {
  const result = checkBudget(makeSummary(), { perAsset: 200 });
  expect(result.exceeded).toBe(true);
  // b.js (500) 超过 200，a.js (100) 未超
  expect(result.messages.some((m) => m.includes("b.js"))).toBe(true);
  expect(result.messages.some((m) => m.includes("a.js"))).toBe(false);
});

test("checkBudget keeps perChunk as a compatibility alias", () => {
  const result = checkBudget(makeSummary(), { perChunk: 200 });
  expect(result.violations[0]).toMatchObject({ kind: "perAsset", asset: "b.js" });
});

test("checkBudget fails closed when a required gzip metric is unavailable", () => {
  const result = checkBudget(makeSummary({ totalGzip: null }), { totalGzip: 100 });
  expect(result.exceeded).toBe(true);
  expect(result.violations[0]).toMatchObject({ kind: "totalGzip", actual: null });
});

test("checkBudget handles empty budget (no limits set)", () => {
  const result = checkBudget(makeSummary(), {});
  expect(result.exceeded).toBe(false);
});

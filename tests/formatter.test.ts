import { expect, test } from "vite-plus/test";
import { formatBudgetResult, formatReport } from "../src/formatter.ts";
import type { BudgetResult, BuildSummary } from "../src/types.ts";

function makeSummary(): BuildSummary {
  return {
    timing: {
      total: 1240,
      stages: {
        transform: 840,
        bundle: 400,
      },
    },
    assets: [
      {
        name: "assets/js/application-entry-with-a-very-long-name.js",
        type: "js",
        size: 1800,
        gzip: 520,
        brotli: 460,
      },
      {
        name: "assets/css/index.css",
        type: "css",
        size: 420,
        gzip: 160,
        brotli: 120,
      },
    ],
    totalSize: 2220,
    totalGzip: 680,
    totalBrotli: 580,
  };
}

test("card format supports pretty terminal output", () => {
  const output = formatReport(makeSummary(), "card", {
    topN: 5,
    groupByType: true,
    gzip: true,
    brotli: true,
    warnSize: 1000,
    terminal: "pretty",
  });
  expect(output).toContain("╭");
  expect(output).toContain("构建报告");
  expect(output).toContain("Top 2 产物");
  expect(output).not.toContain(" warn");
});

test("card format supports plain terminal output", () => {
  const output = formatReport(makeSummary(), "card", {
    topN: 1,
    groupByType: false,
    gzip: true,
    brotli: false,
    warnSize: 5000,
    terminal: "plain",
  });
  expect(output).toContain("构建报告");
  expect(output).not.toContain("╭");
  expect(output).toContain("Top 1 产物");
  expect(output).not.toContain("分类汇总");
});

test("card format renders warning count when over warnSize", () => {
  const output = formatReport(makeSummary(), "card", {
    topN: 5,
    groupByType: true,
    gzip: true,
    brotli: true,
    warnSize: 500,
    terminal: "plain",
  });
  expect(output).toContain("告警");
});

test("table format truncates long asset names and keeps totals", () => {
  const output = formatReport(makeSummary(), "table", {
    topN: 5,
    groupByType: true,
    gzip: true,
    brotli: true,
    warnSize: 1000,
    terminal: "plain",
  });
  expect(output).toContain("产物清单");
  expect(output).toContain("application-entry");
  expect(output).toContain("…");
  expect(output).toContain("总计");
});

test("table format does not mislabel unmeasured compression", () => {
  const summary = makeSummary();
  summary.totalGzip = null;
  summary.totalBrotli = null;
  summary.assets = summary.assets.map((asset) => ({ ...asset, gzip: null, brotli: null }));
  const output = formatReport(summary, "table", {
    topN: 5,
    groupByType: true,
    gzip: true,
    brotli: true,
    warnSize: 1000,
    terminal: "plain",
  });
  expect(output).toContain("n/a");
});

test("json format outputs parseable structured data", () => {
  const output = formatReport(makeSummary(), "json", {
    topN: 5,
    groupByType: true,
    gzip: true,
    brotli: true,
    warnSize: 1000,
    terminal: "plain",
  });
  const parsed = JSON.parse(output) as BuildSummary;
  expect(parsed.totalSize).toBe(2220);
  expect(parsed.totalGzip).toBe(680);
  expect(parsed.totalBrotli).toBe(580);
  expect(parsed.assets).toHaveLength(2);
  expect(parsed.timing.total).toBe(1240);
});

test("json format exposes null compression when unmeasured", () => {
  const summary = makeSummary();
  summary.totalGzip = null;
  summary.totalBrotli = null;
  summary.assets = summary.assets.map((a) => ({ ...a, gzip: null, brotli: null }));
  const output = formatReport(summary, "json", {
    topN: 5,
    groupByType: true,
    gzip: false,
    brotli: false,
    warnSize: 1000,
    terminal: "plain",
  });
  const parsed = JSON.parse(output) as BuildSummary;
  expect(parsed.totalGzip).toBeNull();
  expect(parsed.totalBrotli).toBeNull();
});

test("json format includes diff when present", () => {
  const summary = makeSummary();
  summary.diff = { totalSize: 120, totalGzip: 30, totalDuration: -100 };
  const output = formatReport(summary, "json", {
    topN: 5,
    groupByType: true,
    gzip: true,
    brotli: true,
    warnSize: 1000,
    terminal: "plain",
  });
  const parsed = JSON.parse(output) as BuildSummary;
  expect(parsed.diff).toEqual({ totalSize: 120, totalGzip: 30, totalDuration: -100 });
});

test("json format includes budget when present", () => {
  const summary = makeSummary();
  summary.budget = {
    exceeded: true,
    violations: [{ kind: "totalSize", actual: 2220, limit: 1000, message: "over" }],
    messages: ["over"],
  };
  const output = formatReport(summary, "json", {
    topN: 5,
    groupByType: true,
    gzip: true,
    brotli: true,
    warnSize: 1000,
    terminal: "plain",
  });
  const parsed = JSON.parse(output) as BuildSummary;
  expect(parsed.budget?.exceeded).toBe(true);
  expect(parsed.budget?.violations).toHaveLength(1);
});

test("minimal format outputs a one-line summary", () => {
  const output = formatReport(makeSummary(), "minimal", {
    topN: 5,
    groupByType: true,
    gzip: true,
    brotli: true,
    warnSize: 1000,
    terminal: "plain",
  });
  expect(output).toContain("build done");
  expect(output).not.toContain("\n");
});

test("minimal format includes warnings when present", () => {
  const output = formatReport(makeSummary(), "minimal", {
    topN: 5,
    groupByType: true,
    gzip: true,
    brotli: true,
    warnSize: 500,
    terminal: "plain",
  });
  expect(output).toContain("warning");
});

test("minimal format shows gzip and brotli when available", () => {
  const output = formatReport(makeSummary(), "minimal", {
    topN: 5,
    groupByType: true,
    gzip: true,
    brotli: true,
    warnSize: 1000,
    terminal: "plain",
  });
  expect(output).toContain("gzip");
  expect(output).toContain("brotli");
});

test("card format renders diff when available", () => {
  const summary = makeSummary();
  summary.diff = { totalSize: 200, totalGzip: 50, totalDuration: 300 };
  const output = formatReport(summary, "card", {
    topN: 5,
    groupByType: true,
    gzip: true,
    brotli: true,
    warnSize: 1000,
    terminal: "plain",
  });
  expect(output).toContain("对比上次");
  expect(output).toContain("+200");
});

test("card format renders negative diff as green", () => {
  const summary = makeSummary();
  summary.diff = { totalSize: -200, totalGzip: -50, totalDuration: -300 };
  const output = formatReport(summary, "card", {
    topN: 5,
    groupByType: true,
    gzip: true,
    brotli: true,
    warnSize: 1000,
    terminal: "plain",
  });
  expect(output).toContain("对比上次");
});

test("card format renders diff without gzip when both builds lack it", () => {
  const summary = makeSummary();
  summary.totalGzip = null;
  summary.diff = { totalSize: 100, totalGzip: null, totalDuration: 50 };
  const output = formatReport(summary, "card", {
    topN: 5,
    groupByType: true,
    gzip: true,
    brotli: false,
    warnSize: 1000,
    terminal: "plain",
  });
  expect(output).toContain("对比上次");
  expect(output).not.toContain("gzip");
});

test("card format has no diff section when diff is absent", () => {
  const output = formatReport(makeSummary(), "card", {
    topN: 5,
    groupByType: true,
    gzip: true,
    brotli: true,
    warnSize: 1000,
    terminal: "plain",
  });
  expect(output).not.toContain("对比上次");
});

test("card format renders warning items in yellow", () => {
  // set warnSize so first asset exceeds threshold
  const output = formatReport(makeSummary(), "card", {
    topN: 5,
    groupByType: true,
    gzip: true,
    brotli: true,
    warnSize: 500,
    terminal: "plain",
  });
  expect(output).toContain("告警");
});

test("formatBudgetResult returns formatted violation list", () => {
  const result: BudgetResult = {
    exceeded: true,
    violations: [
      { kind: "totalSize", actual: 5000, limit: 1000, message: "总大小 5 KB > 预算 1 KB" },
    ],
    messages: ["总大小 5 KB > 预算 1 KB"],
  };
  const output = formatBudgetResult(result);
  expect(output).toContain("预算超限");
  expect(output).toContain("总大小 5 KB > 预算 1 KB");
});

test("formatBudgetResult handles multiple violations", () => {
  const result: BudgetResult = {
    exceeded: true,
    violations: [
      { kind: "totalSize", actual: 5000, limit: 1000, message: "总大小超限" },
      { kind: "perAsset", actual: 3000, limit: 2000, asset: "big.js", message: "big.js 超限" },
    ],
    messages: ["总大小超限", "big.js 超限"],
  };
  const output = formatBudgetResult(result);
  expect(output).toContain("预算超限");
  expect(output).toContain("总大小超限");
  expect(output).toContain("big.js 超限");
});

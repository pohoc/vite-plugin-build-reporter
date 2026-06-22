import { expect, test } from "vite-plus/test";
import { formatReport } from "../src/formatter.ts";
import type { BuildSummary } from "../src/types.ts";

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

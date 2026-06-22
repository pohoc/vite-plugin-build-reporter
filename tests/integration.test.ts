import { expect, test } from "vite-plus/test";
import { buildReporter } from "../src/index.ts";
import type { Collectable } from "../src/collector.ts";
import type { BuildSummary } from "../src/types.ts";

function makePlugin(options?: Parameters<typeof buildReporter>[0]) {
  const captured: string[] = [];
  const plugin = buildReporter({ ...options, log: (message) => captured.push(message) });
  return { plugin: plugin as any, captured };
}

async function runBuild(plugin: any, ...bundles: Array<Record<string, Collectable>>) {
  await plugin.buildStart.call({});
  for (const bundle of bundles) {
    await plugin.renderStart.call({}, {}, {});
    await plugin.generateBundle.call({}, {}, bundle);
  }
  await plugin.closeBundle.call({});
}

test("emits card report on closeBundle", async () => {
  const { plugin, captured } = makePlugin();
  await runBuild(plugin, {
    "static/js/app.js": { type: "chunk", code: "a".repeat(2000) },
    "static/css/style.css": { type: "asset", source: ".a{}" },
  });
  expect(captured).toHaveLength(1);
  expect(captured[0]).toContain("构建报告");
  expect(captured[0]).toContain("Top");
  expect(captured[0]).toContain("app.js");
});

test("respects enabled: false", async () => {
  const { plugin, captured } = makePlugin({ enabled: false });
  await runBuild(plugin, {});
  expect(captured).toHaveLength(0);
});

test("minimal format outputs a single line", async () => {
  const { plugin, captured } = makePlugin({ format: "minimal" });
  await runBuild(plugin, { "app.js": { type: "chunk", code: "x".repeat(500) } });
  expect(captured[0]).toContain("build done");
  expect(captured[0]).not.toContain("\n");
});

test("json format exposes unmeasured compression as null", async () => {
  const { plugin, captured } = makePlugin({ format: "json", gzip: false, brotli: false });
  await runBuild(plugin, { "app.js": { type: "chunk", code: "x".repeat(500) } });
  const parsed = JSON.parse(captured[0]) as BuildSummary;
  expect(parsed.assets).toHaveLength(1);
  expect(parsed.totalSize).toBe(500);
  expect(parsed.totalGzip).toBeNull();
  expect(parsed.totalBrotli).toBeNull();
});

test("budget fail rejects closeBundle", async () => {
  const { plugin } = makePlugin({ budget: { totalSize: 1 } });
  await expect(
    runBuild(plugin, { "app.js": { type: "chunk", code: "x".repeat(500) } }),
  ).rejects.toThrow(/预算超限/);
});

test("budget fail:false reports but does not reject", async () => {
  const { plugin, captured } = makePlugin({ budget: { totalSize: 1, fail: false } });
  await expect(
    runBuild(plugin, { "app.js": { type: "chunk", code: "x".repeat(500) } }),
  ).resolves.toBeUndefined();
  expect(captured.some((message) => message.includes("预算超限"))).toBe(true);
});

test("json keeps budget output machine-readable as one document", async () => {
  const { plugin, captured } = makePlugin({
    format: "json",
    budget: { totalSize: 1, fail: false },
  });
  await runBuild(plugin, { "app.js": { type: "chunk", code: "x".repeat(500) } });
  expect(captured).toHaveLength(1);
  expect((JSON.parse(captured[0]) as BuildSummary).budget?.exceeded).toBe(true);
});

test("aggregates every Rollup output", async () => {
  const { plugin, captured } = makePlugin({ format: "json" });
  await runBuild(
    plugin,
    { "app.es.js": { type: "chunk", code: "e".repeat(200) } },
    { "app.cjs": { type: "chunk", code: "c".repeat(300) } },
  );
  const summary = JSON.parse(captured[0]) as BuildSummary;
  expect(summary.assets.map((asset) => asset.name)).toEqual(["app.es.js", "app.cjs"]);
  expect(summary.totalSize).toBe(500);
});

test("does not report or retain partial output from a failed build", async () => {
  const reports: Readonly<BuildSummary>[] = [];
  const { plugin, captured } = makePlugin({
    format: "json",
    onReport: (summary) => {
      reports.push(summary);
    },
  });
  await plugin.buildStart.call({});
  await plugin.renderStart.call({}, {}, {});
  await plugin.generateBundle.call(
    {},
    {},
    {
      "partial.js": { type: "chunk", code: "partial" },
    },
  );
  await plugin.closeBundle.call({}, new Error("write failed"));

  expect(captured).toHaveLength(0);
  expect(reports).toHaveLength(0);

  await runBuild(plugin, { "success.js": { type: "chunk", code: "ok" } });
  expect((JSON.parse(captured[0]) as BuildSummary).assets.map((asset) => asset.name)).toEqual([
    "success.js",
  ]);
});

test("uses renderStart rather than generateBundle as the timing boundary", async () => {
  const timings: BuildSummary["timing"][] = [];
  const { plugin } = makePlugin({
    onReport: (summary) => {
      timings.push(summary.timing);
    },
  });
  await runBuild(plugin, { "app.js": { type: "chunk", code: "x" } });
  expect(timings[0]?.stages).toBeDefined();

  await plugin.buildStart.call({});
  await plugin.generateBundle.call({}, {}, { "app.js": { type: "chunk", code: "x" } });
  await plugin.closeBundle.call({});
  expect(timings[1]?.stages).toBeUndefined();
});

test("does not retain assets between watch rebuilds", async () => {
  const { plugin, captured } = makePlugin({ format: "json" });
  await runBuild(plugin, { "first.js": { type: "chunk", code: "a" } });
  await runBuild(plugin, { "second.js": { type: "chunk", code: "bb" } });
  const second = JSON.parse(captured[1]) as BuildSummary;
  expect(second.assets.map((asset) => asset.name)).toEqual(["second.js"]);
  expect(second.totalSize).toBe(2);
});

test("computes gzip when a hidden gzip budget requires it", async () => {
  const { plugin, captured } = makePlugin({
    format: "json",
    gzip: false,
    budget: { totalGzip: 10_000, fail: false },
  });
  await runBuild(plugin, { "app.js": { type: "chunk", code: "x".repeat(500) } });
  expect((JSON.parse(captured[0]) as BuildSummary).totalGzip).toBeGreaterThan(0);
});

test("awaits the structured onReport callback", async () => {
  let received: Readonly<BuildSummary> | undefined;
  const { plugin } = makePlugin({
    onReport: async (summary) => {
      await Promise.resolve();
      received = summary;
    },
  });
  await runBuild(plugin, { "app.js": { type: "chunk", code: "x" } });
  expect(received?.totalSize).toBe(1);
});

test("rejects invalid runtime options early", () => {
  expect(() => buildReporter({ topN: -1 })).toThrow(/topN/);
  expect(() => buildReporter({ warnSize: Number.NaN })).toThrow(/warnSize/);
  expect(() => buildReporter({ cacheDir: " " })).toThrow(/cacheDir/);
  expect(() => buildReporter({ gzip: "yes" } as any)).toThrow(/gzip/);
  expect(() => buildReporter({ budget: [] } as any)).toThrow(/budget/);
  expect(() => buildReporter({ onReport: true } as any)).toThrow(/onReport/);
});

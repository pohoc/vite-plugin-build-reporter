import { expect, test } from "vite-plus/test";
import { collectAssets, type Collectable } from "../src/collector.ts";

const sampleBundle: Record<string, Collectable> = {
  "static/js/app-abc.js": { type: "chunk", code: "a".repeat(2000) },
  "static/css/style.css": { type: "asset", source: ".a{color:red}" },
  "static/img/logo.png": { type: "asset", source: new Uint8Array([1, 2, 3, 4]) },
};

test("collectAssets collects all entries", async () => {
  const records = await collectAssets(sampleBundle, { gzip: true, brotli: true });
  expect(records).toHaveLength(3);
  const names = records.map((r) => r.name).sort();
  expect(names).toEqual(["static/css/style.css", "static/img/logo.png", "static/js/app-abc.js"]);
});

test("collectAssets detects asset types", async () => {
  const records = await collectAssets(sampleBundle, { gzip: true, brotli: true });
  const byName = Object.fromEntries(records.map((r) => [r.name, r.type]));
  expect(byName["static/js/app-abc.js"]).toBe("js");
  expect(byName["static/css/style.css"]).toBe("css");
  expect(byName["static/img/logo.png"]).toBe("image");
});

test("collectAssets computes raw size from code/source", async () => {
  const records = await collectAssets(sampleBundle, { gzip: true, brotli: true });
  const js = records.find((r) => r.name === "static/js/app-abc.js");
  expect(js?.size).toBe(2000);
  const png = records.find((r) => r.name === "static/img/logo.png");
  expect(png?.size).toBe(4);
});

test("collectAssets computes gzip and brotli smaller than raw", async () => {
  const records = await collectAssets(sampleBundle, { gzip: true, brotli: true });
  const js = records.find((r) => r.name === "static/js/app-abc.js");
  expect(js?.gzip).toBeLessThan(js!.size);
  expect(js?.brotli).toBeLessThan(js!.size);
});

test("collectAssets marks disabled compression metrics as unmeasured", async () => {
  const records = await collectAssets(sampleBundle, { gzip: false, brotli: false });
  const js = records.find((r) => r.name === "static/js/app-abc.js");
  expect(js?.gzip).toBeNull();
  expect(js?.brotli).toBeNull();
});

test("collectAssets excludes source maps by default", async () => {
  const bundle: Record<string, Collectable> = {
    "app.js": { type: "chunk", code: "console.log(1)" },
    "app.js.map": { type: "asset", source: '{"version":3}' },
  };
  expect(
    (await collectAssets(bundle, { gzip: false, brotli: false })).map((item) => item.name),
  ).toEqual(["app.js"]);
  expect(
    (await collectAssets(bundle, { gzip: false, brotli: false, includeSourceMaps: true })).map(
      (item) => item.name,
    ),
  ).toEqual(["app.js", "app.js.map"]);
});

import { expect, test } from "vite-plus/test";
import {
  brotliSize,
  detectAssetType,
  formatBytes,
  formatPercent,
  gzipSize,
  rawByteLength,
  renderBarParts,
} from "../src/utils.ts";

test("formatBytes formats positive values", () => {
  expect(formatBytes(0)).toBe("0 B");
  expect(formatBytes(512)).toBe("512 B");
  expect(formatBytes(1000)).toBe("1 kB");
  expect(formatBytes(412000)).toBe("412 kB");
  expect(formatBytes(2300000)).toBe("2.3 MB");
  expect(formatBytes(1)).toBe("1 B");
});

test("formatBytes handles edge cases", () => {
  expect(formatBytes(NaN)).toBe("0 B");
  expect(formatBytes(Infinity)).toBe("0 B");
  expect(formatBytes(-Infinity)).toBe("0 B");
  expect(formatBytes(-1)).toBe("0 B");
  expect(formatBytes(-0)).toBe("0 B");
});

test("formatBytes clamps unit index for large values", () => {
  expect(formatBytes(1000 ** 3 * 9.8)).toBe("9.8 GB");
  // 超出 GB 时返回 GB 单位
  expect(formatBytes(1000 ** 4)).toBe("1000 GB");
});

test("detectAssetType maps JS variants", () => {
  expect(detectAssetType("app.js")).toBe("js");
  expect(detectAssetType("app.mjs")).toBe("js");
  expect(detectAssetType("vendor.cjs")).toBe("js");
  expect(detectAssetType("chunk-abc.mjs")).toBe("js");
});

test("detectAssetType maps CSS", () => {
  expect(detectAssetType("style.css")).toBe("css");
  expect(detectAssetType("main.css.map")).toBe("other");
});

test("detectAssetType maps font extensions", () => {
  expect(detectAssetType("font.woff2")).toBe("font");
  expect(detectAssetType("font.woff")).toBe("font");
  expect(detectAssetType("font.ttf")).toBe("font");
  expect(detectAssetType("font.otf")).toBe("font");
  expect(detectAssetType("font.eot")).toBe("font");
});

test("detectAssetType maps image extensions", () => {
  expect(detectAssetType("logo.png")).toBe("image");
  expect(detectAssetType("photo.jpeg")).toBe("image");
  expect(detectAssetType("photo.jpg")).toBe("image");
  expect(detectAssetType("icon.svg")).toBe("image");
  expect(detectAssetType("img.webp")).toBe("image");
  expect(detectAssetType("img.avif")).toBe("image");
  expect(detectAssetType("favicon.ico")).toBe("image");
  expect(detectAssetType("img.gif")).toBe("image");
});

test("detectAssetType fallback to other", () => {
  expect(detectAssetType("data.json")).toBe("other");
  expect(detectAssetType("index.html")).toBe("other");
  expect(detectAssetType("data.xml")).toBe("other");
});

test("renderBarParts marks the occupied span for coloring", () => {
  expect(renderBarParts(0.55, 10)).toEqual({ filled: "─".repeat(11), empty: "─".repeat(9) });
  expect(renderBarParts(0.62, 10)).toEqual({ filled: "─".repeat(12), empty: "─".repeat(8) });
  expect(renderBarParts(0.04, 10)).toEqual({ filled: "─", empty: "─".repeat(19) });
  expect(renderBarParts(0, 10)).toEqual({ filled: "", empty: "─".repeat(20) });
  expect(renderBarParts(1, 10)).toEqual({ filled: "─".repeat(20), empty: "" });
  expect(renderBarParts(0.001, 0)).toEqual({ filled: "", empty: "" });
});

test("renderBarParts clamps out-of-range fractions", () => {
  expect(renderBarParts(-0.5, 10).filled).toBe("");
  expect(renderBarParts(-0.5, 10).empty).toBe("─".repeat(20));
  expect(renderBarParts(1.5, 10).filled).toBe("─".repeat(20));
  expect(renderBarParts(1.5, 10).empty).toBe("");
});

test("renderBarParts handles non-finite width gracefully", () => {
  const result = renderBarParts(0.5, NaN);
  expect(result.filled).toBe("");
  expect(result.empty).toBe("");
});

test("formatPercent handles normal ratios and edge cases", () => {
  expect(formatPercent(50, 200)).toBe("25.0%");
  expect(formatPercent(0, 100)).toBe("0.0%");
  expect(formatPercent(200, 100)).toBe("200.0%");
  expect(formatPercent(0, 0)).toBe("0%");
});

test("gzipSize and brotliSize compress repetitive content", async () => {
  const big = "a".repeat(1000);
  expect(await gzipSize(big)).toBeLessThan(big.length);
  expect(await brotliSize(big)).toBeLessThan(big.length);
});

test("rawByteLength counts utf-8 bytes", () => {
  expect(rawByteLength("abc")).toBe(3);
  expect(rawByteLength("中文")).toBe(6);
  expect(rawByteLength(new Uint8Array([1, 2, 3]))).toBe(3);
});

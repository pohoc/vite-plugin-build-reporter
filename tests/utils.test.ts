import { expect, test } from "vite-plus/test";
import {
  brotliSize,
  detectAssetType,
  formatBytes,
  formatPercent,
  gzipSize,
  maxSize,
  rawByteLength,
  renderBar,
  renderBarParts,
} from "../src/utils.ts";

test("formatBytes formats human-readable sizes", () => {
  expect(formatBytes(0)).toBe("0 B");
  expect(formatBytes(512)).toBe("512 B");
  expect(formatBytes(1024)).toBe("1 KB");
  expect(formatBytes(412 * 1024)).toBe("412 KB");
  expect(formatBytes(1024 * 1024 * 2.3)).toBe("2.3 MB");
});

test("detectAssetType maps extensions to types", () => {
  expect(detectAssetType("app.js")).toBe("js");
  expect(detectAssetType("app.mjs")).toBe("js");
  expect(detectAssetType("vendor.cjs")).toBe("js");
  expect(detectAssetType("style.css")).toBe("css");
  expect(detectAssetType("font.woff2")).toBe("font");
  expect(detectAssetType("logo.png")).toBe("image");
  expect(detectAssetType("data.json")).toBe("other");
});

test("renderBar clamps and fills", () => {
  expect(renderBar(0)).toBe("░".repeat(10));
  expect(renderBar(1)).toBe("█".repeat(10));
  expect(renderBar(0.5)).toBe("█████░░░░░");
  expect(renderBar(1.5)).toBe("█".repeat(10));
  expect(renderBar(-1)).toBe("░".repeat(10));
});

test("renderBar uses continuous full cells without partial-cell gaps", () => {
  expect(renderBar(0.55, 10)).toBe("██████░░░░");
  expect(renderBar(0.57, 10)).toBe("██████░░░░");
});

test("renderBar keeps small non-zero values visible", () => {
  expect(renderBar(0.01, 10)).toBe("█░░░░░░░░░");
  expect(renderBar(0.001, 0)).toBe("");
});

test("renderBarParts splits filled and empty segments", () => {
  expect(renderBarParts(0.55, 10)).toEqual({ filled: "██████", empty: "░░░░" });
  expect(renderBarParts(0, 10)).toEqual({ filled: "", empty: "░░░░░░░░░░" });
  expect(renderBarParts(1, 10)).toEqual({ filled: "██████████", empty: "" });
});

test("maxSize returns largest or 0", () => {
  expect(
    maxSize([
      { name: "a", type: "js", size: 100, gzip: 10, brotli: 8 },
      { name: "b", type: "js", size: 300, gzip: 30, brotli: 25 },
    ]),
  ).toBe(300);
  expect(maxSize([])).toBe(0);
});

test("formatPercent handles ratios and zero total", () => {
  expect(formatPercent(50, 200)).toBe("25.0%");
  expect(formatPercent(0, 0)).toBe("0%");
});

test("gzipSize and brotliSize compress repetitive content", () => {
  const big = "a".repeat(1000);
  expect(gzipSize(big)).toBeLessThan(big.length);
  expect(brotliSize(big)).toBeLessThan(big.length);
});

test("rawByteLength counts utf-8 bytes", () => {
  expect(rawByteLength("abc")).toBe(3);
  expect(rawByteLength("中文")).toBe(6);
  expect(rawByteLength(new Uint8Array([1, 2, 3]))).toBe(3);
});

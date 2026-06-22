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

test("renderBar always spans the full cell count as a continuous line", () => {
  // 统一细线 ─，占比由 formatter 染色体现；字符串本身恒等长
  expect(renderBar(0)).toBe("─".repeat(20));
  expect(renderBar(1)).toBe("─".repeat(20));
  expect(renderBar(0.5)).toBe("─".repeat(20));
  expect(renderBar(1.5)).toBe("─".repeat(20));
  expect(renderBar(-1)).toBe("─".repeat(20));
});

test("renderBarParts marks the occupied span for coloring", () => {
  // 占用段长度反映占比（2 倍密度），formatter 据此分段染色
  expect(renderBarParts(0.55, 10)).toEqual({ filled: "─".repeat(11), empty: "─".repeat(9) });
  expect(renderBarParts(0.62, 10)).toEqual({ filled: "─".repeat(12), empty: "─".repeat(8) });
  expect(renderBarParts(0.04, 10)).toEqual({ filled: "─", empty: "─".repeat(19) });
  expect(renderBarParts(0, 10)).toEqual({ filled: "", empty: "─".repeat(20) });
  expect(renderBarParts(1, 10)).toEqual({ filled: "─".repeat(20), empty: "" });
  expect(renderBarParts(0.001, 0)).toEqual({ filled: "", empty: "" });
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

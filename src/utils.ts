import { promisify } from "node:util";
import { brotliCompress, constants, gzip } from "node:zlib";
import type { AssetType } from "./types.ts";

const gzipAsync = promisify(gzip);
const brotliAsync = promisify(brotliCompress);

const SIZE_UNITS = ["B", "kB", "MB", "GB"] as const;

/** 字节 → 人类可读，如 412 kB / 2.3 MB（1 kB = 1000 字节，与 Vite 内置输出保持一致） */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const unitIndex = Math.min(
    Math.max(0, Math.floor(Math.log(bytes) / Math.log(1000))),
    SIZE_UNITS.length - 1,
  );
  const value = bytes / 1000 ** unitIndex;
  const display = unitIndex === 0 ? value.toFixed(0) : value.toFixed(1).replace(/\.0$/, "");
  return `${display} ${SIZE_UNITS[unitIndex]}`;
}

/** 计算 gzip 字节大小（异步，不阻塞事件循环） */
export async function gzipSize(input: string | Uint8Array): Promise<number> {
  return (await gzipAsync(Buffer.from(input))).length;
}

/** 计算 brotli 字节大小（quality 9：比默认 11 快数倍，体积估算足够；异步不阻塞） */
export async function brotliSize(input: string | Uint8Array): Promise<number> {
  return (
    await brotliAsync(Buffer.from(input), {
      params: { [constants.BROTLI_PARAM_QUALITY]: 9 },
    })
  ).length;
}

/** 原始内容的字节长度 */
export function rawByteLength(raw: string | Uint8Array): number {
  return typeof raw === "string" ? Buffer.byteLength(raw) : raw.byteLength;
}

/** 根据文件名推断产物类型 */
export function detectAssetType(fileName: string): AssetType {
  if (/\.(?:m?js|cjs)$/i.test(fileName)) return "js";
  if (/\.css$/i.test(fileName)) return "css";
  if (/\.(?:woff2?|ttf|otf|eot)$/i.test(fileName)) return "font";
  if (/\.(?:png|jpe?g|gif|webp|avif|svg|ico)$/i.test(fileName)) return "image";
  return "other";
}

/** 拆分进度条的已填充段与空槽，便于分段着色 */
export function renderBarParts(fraction: number, width = 10): { filled: string; empty: string } {
  // 统一细线 ─，不靠粗细字符切换（手动划线）；占比完全由 formatter 分段染色体现——
  // 占用段染占用色、空槽染默认色，线条连续、过渡处仅颜色变化。精度到 1 字符位（2 倍密度）。
  const cells = Number.isFinite(width) ? Math.max(0, Math.floor(width * 2)) : 0;
  if (cells === 0) return { filled: "", empty: "" };
  const clamped = Math.max(0, Math.min(1, fraction));
  const filledCount = Math.round(clamped * cells);
  return { filled: "─".repeat(filledCount), empty: "─".repeat(cells - filledCount) };
}

/** 百分比格式化 */
export function formatPercent(part: number, total: number): string {
  if (total <= 0) return "0%";
  return `${((part / total) * 100).toFixed(1)}%`;
}

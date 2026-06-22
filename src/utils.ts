import { brotliCompressSync, constants, gzipSync } from "node:zlib";
import type { AssetRecord, AssetType } from "./types.ts";

const SIZE_UNITS = ["B", "KB", "MB", "GB"] as const;

/** 字节 → 人类可读，如 412 KB / 2.3 MB */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const unitIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), SIZE_UNITS.length - 1);
  const value = bytes / 1024 ** unitIndex;
  // B 取整；KB/MB/GB 保留 1 位小数，整数时省略 .0（如 412 KB 而非 412.0 KB）
  const display = unitIndex === 0 ? value.toFixed(0) : value.toFixed(1).replace(/\.0$/, "");
  return `${display} ${SIZE_UNITS[unitIndex]}`;
}

/** 计算 gzip 字节大小 */
export function gzipSize(input: string | Uint8Array): number {
  const buffer = Buffer.from(input);
  return gzipSync(buffer).length;
}

/** 计算 brotli 字节大小（quality 9：比默认 11 快数倍，体积估算足够） */
export function brotliSize(input: string | Uint8Array): number {
  const buffer = Buffer.from(input);
  return brotliCompressSync(buffer, {
    params: { [constants.BROTLI_PARAM_QUALITY]: 9 },
  }).length;
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

/** 渲染连续进度条，fraction 取值 0~1 */
export function renderBar(fraction: number, width = 10): string {
  const { filled, empty } = renderBarParts(fraction, width);
  return `${filled}${empty}`;
}

/** 拆分进度条的已填充段与空槽，便于分段着色 */
export function renderBarParts(fraction: number, width = 10): { filled: string; empty: string } {
  const safeWidth = Number.isFinite(width) ? Math.max(0, Math.floor(width)) : 0;
  const clamped = Math.max(0, Math.min(1, fraction));
  // 半格/八分之一格字符内部带空白，不同终端字体下会在实心段中形成明显断口。
  // 改用整格渲染；非零占比至少显示一格，精确比例仍由旁边的百分比文本表达。
  const filledCount =
    clamped <= 0 ? 0 : Math.min(safeWidth, Math.max(1, Math.round(clamped * safeWidth)));
  const filled = "█".repeat(filledCount);
  const empty = "░".repeat(safeWidth - filledCount);
  return { filled, empty };
}

/** 产物列表中的最大 size */
export function maxSize(assets: AssetRecord[]): number {
  return assets.reduce((max, asset) => Math.max(max, asset.size), 0);
}

/** 百分比格式化 */
export function formatPercent(part: number, total: number): string {
  if (total <= 0) return "0%";
  return `${((part / total) * 100).toFixed(1)}%`;
}

import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { BuildDiff, BuildSummary } from "./types.ts";

const DEFAULT_CACHE_DIR = "node_modules/.cache/vite-plugin-build-reporter";
const CACHE_FILE = "last-build.json";

export interface Snapshot {
  version: 1;
  totalSize: number;
  totalGzip: number | null;
  duration: number;
}

export function resolveCacheDir(custom?: string, root = process.cwd()): string {
  return resolve(root, custom ?? DEFAULT_CACHE_DIR);
}

/** 读取上次构建快照，缺失或损坏时返回 null */
export function readSnapshot(dir: string): Snapshot | null {
  try {
    const file = resolve(dir, CACHE_FILE);
    if (!existsSync(file)) return null;
    return parseSnapshot(JSON.parse(readFileSync(file, "utf8")));
  } catch {
    return null;
  }
}

/** 写入本次构建快照（仅在 compare 启用时调用），失败不中断构建 */
export function writeSnapshot(dir: string, snapshot: Omit<Snapshot, "version">): boolean {
  let temporaryFile: string | undefined;
  try {
    const file = resolve(dir, CACHE_FILE);
    mkdirSync(dirname(file), { recursive: true });
    temporaryFile = `${file}.${process.pid}.${Date.now()}.tmp`;
    writeFileSync(temporaryFile, JSON.stringify({ version: 1, ...snapshot }, null, 2), "utf8");
    try {
      renameSync(temporaryFile, file);
    } catch {
      // Windows 上 rename 不会始终覆盖已存在的目标文件。
      rmSync(file, { force: true });
      renameSync(temporaryFile, file);
    }
    return true;
  } catch {
    // 缓存写入失败不应影响构建流程
    try {
      if (temporaryFile) rmSync(temporaryFile, { force: true });
    } catch {
      // best-effort cleanup
    }
    return false;
  }
}

/** 计算与上次构建的差异，无历史数据返回 null */
export function diffAgainst(current: BuildSummary, prev: Snapshot | null): BuildDiff | null {
  if (!prev) return null;
  return {
    totalSize: current.totalSize - prev.totalSize,
    totalGzip:
      current.totalGzip === null || prev.totalGzip === null
        ? null
        : current.totalGzip - prev.totalGzip,
    totalDuration: current.timing.total - prev.duration,
  };
}

function parseSnapshot(value: unknown): Snapshot | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<Snapshot>;
  if (!isNonNegativeFinite(candidate.totalSize) || !isNonNegativeFinite(candidate.duration)) {
    return null;
  }
  if (candidate.totalGzip !== null && !isNonNegativeFinite(candidate.totalGzip)) return null;
  if (candidate.version !== undefined && candidate.version !== 1) return null;
  return {
    version: 1,
    totalSize: candidate.totalSize,
    totalGzip: candidate.totalGzip ?? null,
    duration: candidate.duration,
  };
}

function isNonNegativeFinite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

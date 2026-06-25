import type { Plugin } from "vite";
import { checkBudget } from "./budget.ts";
import { collectAssets } from "./collector.ts";
import type { Collectable } from "./collector.ts";
import { formatBudgetResult, formatReport } from "./formatter.ts";
import { diffAgainst, readSnapshot, resolveCacheDir, writeSnapshot } from "./storage.ts";
import { Timer } from "./timer.ts";
import type {
  AssetRecord,
  BudgetOptions,
  BuildReporterOptions,
  BuildSummary,
  ReportFormat,
  TerminalMode,
} from "./types.ts";

export type {
  AssetRecord,
  AssetType,
  BudgetOptions,
  BudgetResult,
  BudgetViolation,
  BudgetViolationKind,
  BuildDiff,
  BuildReporterOptions,
  BuildSummary,
  BuildTiming,
  ReportFormat,
  TerminalMode,
  TimingStage,
} from "./types.ts";
export type {
  Collectable,
  CollectableAsset,
  CollectableChunk,
  CollectAssetsOptions,
} from "./collector.ts";
export type { FormatOptions } from "./formatter.ts";
export { checkBudget } from "./budget.ts";
export { collectAssets } from "./collector.ts";
export { formatBudgetResult, formatReport } from "./formatter.ts";
export { Timer } from "./timer.ts";

/** vite 默认的 chunkSizeWarningLimit（KB） */
const DEFAULT_CHUNK_LIMIT_KB = 500;
const VALID_FORMATS = ["card", "table", "minimal", "json"] as const;
const VALID_TERMINALS = ["auto", "pretty", "plain"] as const;

interface ResolvedOptions {
  enabled: boolean;
  format: ReportFormat;
  terminal: Exclude<TerminalMode, "auto">;
  topN: number;
  groupByType: boolean;
  gzip: boolean;
  brotli: boolean;
  includeSourceMaps: boolean;
  warnSize: number;
  compare: boolean;
  cacheDir: string;
  budget?: BudgetOptions;
  onReport?: BuildReporterOptions["onReport"];
  log: (message: string) => void;
}

function resolveOptions(options: BuildReporterOptions): ResolvedOptions {
  validateOptions(options);
  return {
    enabled: options.enabled ?? true,
    format: options.format ?? "card",
    terminal: resolveTerminalMode(options.terminal),
    topN: options.topN ?? 10,
    groupByType: options.groupByType ?? true,
    gzip: options.gzip ?? true,
    brotli: options.brotli ?? false,
    includeSourceMaps: options.includeSourceMaps ?? false,
    // 兜底值；若用户未显式设置，configResolved 会用 vite 的 chunkSizeWarningLimit 覆盖
    warnSize: options.warnSize ?? DEFAULT_CHUNK_LIMIT_KB * 1000,
    compare: options.compare ?? false,
    cacheDir: resolveCacheDir(options.cacheDir),
    budget: options.budget,
    onReport: options.onReport,
    log: options.log ?? ((message) => console.log(message)),
  };
}

function resolveTerminalMode(mode: TerminalMode = "auto"): Exclude<TerminalMode, "auto"> {
  if (mode !== "auto") return mode;
  const stdout = process.stdout as NodeJS.WriteStream | undefined;
  return stdout?.isTTY && !process.env.CI ? "pretty" : "plain";
}

/**
 * Vite 构建报告插件：构建结束后在终端输出耗时、产物大小、Top N 排行、
 * 分类汇总与（可选）历史对比，不生成任何报告文件。
 *
 * 使用 Rollup 标准钩子，兼容 Rollup 与 Rolldown 后端。
 */
export function buildReporter(options: BuildReporterOptions = {}): Plugin {
  const opts = resolveOptions(options);
  const userWarnSize = options.warnSize;
  const timer = new Timer();
  let assets: AssetRecord[] = [];
  let hasBundle = false;

  return {
    name: "vite-plugin-build-reporter",
    apply: "build",
    enforce: "post",
    configResolved(resolvedConfig) {
      // 未显式配置 warnSize 时，沿用 vite 的 build.chunkSizeWarningLimit（KB → 字节，
      // 与 vite 内部一致按 1000 换算）
      if (userWarnSize === undefined) {
        const limitKB = resolvedConfig.build.chunkSizeWarningLimit ?? DEFAULT_CHUNK_LIMIT_KB;
        opts.warnSize = limitKB * 1000;
      }
      opts.cacheDir = resolveCacheDir(options.cacheDir, resolvedConfig.root);
    },
    buildStart() {
      if (!opts.enabled) return;
      assets = [];
      hasBundle = false;
      timer.begin();
    },
    renderStart() {
      if (!opts.enabled) return;
      // renderStart 是 Rollup/Rolldown 输出生成阶段的真实起点；generateBundle 已接近阶段末尾。
      timer.markBundleStart();
    },
    generateBundle(_outputOptions, bundle) {
      if (!opts.enabled) return;
      assets.push(
        ...collectAssets(bundle as Record<string, Collectable>, {
          gzip: opts.gzip || opts.budget?.totalGzip !== undefined,
          brotli: opts.brotli,
          includeSourceMaps: opts.includeSourceMaps,
        }),
      );
      hasBundle = true;
    },
    async closeBundle(error?: Error) {
      if (!opts.enabled) return;
      if (error || !hasBundle) {
        // 失败构建不得输出部分报告或覆盖成功构建的历史基线。
        timer.done();
        assets = [];
        hasBundle = false;
        return;
      }
      const timing = timer.done();
      const summary: BuildSummary = {
        timing,
        assets: assets.slice(),
        totalSize: sumMetric(assets, "size"),
        totalGzip: sumOptionalMetric(assets, "gzip"),
        totalBrotli: sumOptionalMetric(assets, "brotli"),
      };

      try {
        if (opts.compare) {
          summary.diff = diffAgainst(summary, readSnapshot(opts.cacheDir)) ?? undefined;
        }

        if (opts.budget) summary.budget = checkBudget(summary, opts.budget);

        opts.log(
          formatReport(summary, opts.format, {
            topN: opts.topN,
            groupByType: opts.groupByType,
            gzip: opts.gzip,
            brotli: opts.brotli,
            warnSize: opts.warnSize,
            terminal: opts.terminal,
          }),
        );

        await opts.onReport?.(summary);

        if (summary.budget?.exceeded) {
          // JSON 已嵌入结构化预算结果，不再混入第二段非 JSON 输出。
          if (opts.format !== "json") opts.log(formatBudgetResult(summary.budget));
          if (opts.budget?.fail !== false) {
            throw new Error(
              `[vite-plugin-build-reporter] 预算超限:\n${summary.budget.messages.map((message) => `  - ${message}`).join("\n")}`,
            );
          }
        }

        // 失败的预算门禁不应覆盖上一次成功构建的对比基线。
        if (opts.compare) {
          writeSnapshot(opts.cacheDir, {
            totalSize: summary.totalSize,
            totalGzip: summary.totalGzip,
            duration: timing.total,
          });
        }
      } finally {
        assets = [];
        hasBundle = false;
      }
    },
  };
}

function sumMetric(records: AssetRecord[], metric: "size"): number {
  return records.reduce((sum, record) => sum + record[metric], 0);
}

function sumOptionalMetric(records: AssetRecord[], metric: "gzip" | "brotli"): number | null {
  let sum = 0;
  for (const record of records) {
    if (record[metric] === null) return null;
    sum += record[metric];
  }
  return sum;
}

function validateOptions(options: BuildReporterOptions): void {
  if (options === null || typeof options !== "object" || Array.isArray(options)) {
    invalidOption("options", "必须是对象");
  }
  validateBoolean("enabled", options.enabled);
  validateBoolean("groupByType", options.groupByType);
  validateBoolean("gzip", options.gzip);
  validateBoolean("brotli", options.brotli);
  validateBoolean("includeSourceMaps", options.includeSourceMaps);
  validateBoolean("compare", options.compare);
  if (options.format !== undefined && !VALID_FORMATS.includes(options.format)) {
    invalidOption("format", "必须是 card、table、minimal 或 json");
  }
  if (options.terminal !== undefined && !VALID_TERMINALS.includes(options.terminal)) {
    invalidOption("terminal", "必须是 auto、pretty 或 plain");
  }
  if (options.topN !== undefined && (!Number.isInteger(options.topN) || options.topN < 0)) {
    invalidOption("topN", "必须是非负整数");
  }
  validateNonNegativeNumber("warnSize", options.warnSize);
  if (
    options.budget !== undefined &&
    (options.budget === null || typeof options.budget !== "object" || Array.isArray(options.budget))
  ) {
    invalidOption("budget", "必须是对象");
  }
  validateNonNegativeNumber("budget.totalSize", options.budget?.totalSize);
  validateNonNegativeNumber("budget.totalGzip", options.budget?.totalGzip);
  validateNonNegativeNumber("budget.perAsset", options.budget?.perAsset);
  validateNonNegativeNumber("budget.perChunk", options.budget?.perChunk);
  validateBoolean("budget.fail", options.budget?.fail);
  if (options.cacheDir !== undefined) {
    if (typeof options.cacheDir !== "string") invalidOption("cacheDir", "必须是字符串");
    if (options.cacheDir.trim() === "") invalidOption("cacheDir", "不能是空字符串");
  }
  validateFunction("onReport", options.onReport);
  validateFunction("log", options.log);
}

function validateBoolean(name: string, value: boolean | undefined): void {
  if (value !== undefined && typeof value !== "boolean") invalidOption(name, "必须是布尔值");
}

function validateFunction(name: string, value: unknown): void {
  if (value !== undefined && typeof value !== "function") invalidOption(name, "必须是函数");
}

function validateNonNegativeNumber(name: string, value: number | undefined): void {
  if (value !== undefined && (!Number.isFinite(value) || value < 0)) {
    invalidOption(name, "必须是非负有限数");
  }
}

function invalidOption(name: string, reason: string): never {
  throw new TypeError(`[vite-plugin-build-reporter] ${name} ${reason}`);
}

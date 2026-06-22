export type AssetType = "js" | "css" | "font" | "image" | "other";

export interface AssetRecord {
  /** 产物文件名，如 element-plus-abc.js */
  name: string;
  /** 产物类型 */
  type: AssetType;
  /** 原始字节大小 */
  size: number;
  /** gzip 压缩后字节大小，未计算时为 null */
  gzip: number | null;
  /** brotli 压缩后字节大小，未计算时为 null */
  brotli: number | null;
}

export type TimingStage = "transform" | "bundle";

export interface BuildTiming {
  /** 构建总耗时（毫秒） */
  total: number;
  /** 分阶段耗时（毫秒） */
  stages?: Partial<Record<TimingStage, number>>;
}

export interface BuildDiff {
  /** 总大小变化（字节，正为增大） */
  totalSize: number;
  /** 总 gzip 变化（字节），任一次未计算 gzip 时为 null */
  totalGzip: number | null;
  /** 总耗时变化（毫秒） */
  totalDuration: number;
}

export interface BuildSummary {
  timing: BuildTiming;
  assets: AssetRecord[];
  totalSize: number;
  /** 总 gzip 大小，未计算时为 null */
  totalGzip: number | null;
  /** 总 brotli 大小，未计算时为 null */
  totalBrotli: number | null;
  /** 与上次构建的对比（仅 compare 启用且有历史数据时存在） */
  diff?: BuildDiff;
  /** 预算检查结果（仅配置 budget 时存在） */
  budget?: BudgetResult;
}

export type ReportFormat = "card" | "table" | "minimal" | "json";
export type TerminalMode = "auto" | "pretty" | "plain";

export interface BudgetOptions {
  /** 产物总大小上限（字节，raw） */
  totalSize?: number;
  /** 产物总 gzip 上限（字节） */
  totalGzip?: number;
  /** 单个产物大小上限（字节，raw） */
  perAsset?: number;
  /** @deprecated 请使用 perAsset；保留为兼容别名 */
  perChunk?: number;
  /** 超预算时是否让构建失败，默认 true */
  fail?: boolean;
}

export type BudgetViolationKind = "totalSize" | "totalGzip" | "perAsset";

export interface BudgetViolation {
  kind: BudgetViolationKind;
  actual: number | null;
  limit: number;
  asset?: string;
  message: string;
}

export interface BudgetResult {
  exceeded: boolean;
  violations: BudgetViolation[];
  messages: string[];
}

export interface BuildReporterOptions {
  /** 是否启用，默认 true */
  enabled?: boolean;
  /** 输出样式，默认 'card' */
  format?: ReportFormat;
  /** 终端渲染模式：auto 按 TTY/CI 判断，pretty 使用边框/进度条，plain 使用纯文本 */
  terminal?: TerminalMode;
  /** Top N 排行数量，默认 10 */
  topN?: number;
  /** 是否按类型分类汇总，默认 true */
  groupByType?: boolean;
  /** 是否计算并显示 gzip 大小，默认 true */
  gzip?: boolean;
  /** 是否计算并显示 brotli 大小，默认 false（同步计算较重，会显著增加构建时间，按需开启） */
  brotli?: boolean;
  /** 是否把 source map 计入产物统计，默认 false */
  includeSourceMaps?: boolean;
  /** 大文件告警阈值（字节）。未设置时默认联动 vite 的 build.chunkSizeWarningLimit */
  warnSize?: number;
  /** 历史对比。默认 false（纯内存零文件）；true 时写入 node_modules/.cache */
  compare?: boolean;
  /** 对比缓存目录，默认 node_modules/.cache/vite-plugin-build-reporter */
  cacheDir?: string;
  /** 预算门禁：超限可让构建失败（CI 防回归） */
  budget?: BudgetOptions;
  /** 报告生成后的结构化回调，支持异步上报 */
  onReport?: (summary: Readonly<BuildSummary>) => void | Promise<void>;
  /** 自定义输出函数，默认 console.log（便于测试） */
  log?: (message: string) => void;
}

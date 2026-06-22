import picocolors from "picocolors";
import type {
  AssetRecord,
  AssetType,
  BuildDiff,
  BuildSummary,
  BudgetResult,
  ReportFormat,
  TerminalMode,
} from "./types.ts";
import { formatBytes, formatPercent, renderBarParts } from "./utils.ts";

const TYPE_ORDER: AssetType[] = ["js", "css", "font", "image", "other"];
const TYPE_LABEL: Record<AssetType, string> = {
  js: "JS",
  css: "CSS",
  font: "Font",
  image: "Image",
  other: "Other",
};
const CARD_WIDTH = 82;
const TABLE_NAME_WIDTH = 38;
const ESCAPE = String.fromCharCode(27);
// eslint-disable-next-line no-control-regex -- 需匹配 ANSI 转义序列（含 ESC 控制字符）
const ANSI_RE = /\x1b\[[0-9;]*m/g;
const ANSI_TOKEN_RE = new RegExp(`${ESCAPE}\\[[0-9;]*m|.`, "gu");

export interface FormatOptions {
  topN: number;
  groupByType: boolean;
  gzip: boolean;
  brotli: boolean;
  warnSize: number;
  terminal?: Exclude<TerminalMode, "auto">;
}

type ResolvedFormatOptions = Omit<FormatOptions, "terminal"> & {
  terminal: Exclude<TerminalMode, "auto">;
};

export function formatReport(
  summary: BuildSummary,
  format: ReportFormat,
  options: FormatOptions,
): string {
  const resolvedOptions: ResolvedFormatOptions = {
    ...options,
    terminal: options.terminal ?? "plain",
  };
  if (format === "json") return renderJson(summary);
  if (format === "minimal") return renderMinimal(summary, resolvedOptions);
  if (format === "table") return renderTable(summary, resolvedOptions);
  return renderCard(summary, resolvedOptions);
}

/** 预算超限展示 */
export function formatBudgetResult(result: BudgetResult): string {
  const c = picocolors;
  const lines = result.messages.map((message) => `  ${c.red("✗")} ${message}`);
  return `${c.red(c.bold("⚠ 预算超限"))}\n${lines.join("\n")}`;
}

function renderJson(summary: BuildSummary): string {
  return JSON.stringify(summary, null, 2);
}

function renderCard(summary: BuildSummary, options: ResolvedFormatOptions): string {
  const { assets, diff, timing, totalBrotli, totalGzip, totalSize } = summary;
  const c = picocolors;
  const warningCount = assets.filter((asset) => asset.size > options.warnSize).length;
  const lines: string[] = [
    renderMetricRow([
      ["总大小", c.bold(c.green(formatBytes(totalSize)))],
      ["耗时", formatDuration(timing.total)],
      ["产物", `${assets.length}`],
      ["告警", warningCount > 0 ? c.yellow(`${warningCount}`) : c.green("0")],
    ]),
  ];

  const compression = renderCompressionLine(totalSize, totalGzip, totalBrotli, options);
  if (compression) lines.push(compression);

  const stages = renderStages(timing.stages);
  if (stages) lines.push(stages);

  const top = sortAssets(assets).slice(0, options.topN);
  if (top.length > 0) {
    lines.push("", c.bold(`Top ${top.length} 产物`), ...renderTopAssets(top, totalSize, options));
  }

  if (options.groupByType && assets.length > 0) {
    lines.push("", c.bold("分类汇总"), ...renderGroups(assets, totalSize, options.terminal));
  }

  if (diff) {
    lines.push("", renderDiff(diff));
  }

  if (options.terminal === "pretty") {
    return renderBox("构建报告", lines);
  }

  return ["", c.bold("构建报告"), c.gray("=".repeat(8)), ...lines].join("\n");
}

function renderTable(summary: BuildSummary, options: ResolvedFormatOptions): string {
  const { assets, timing, totalBrotli, totalGzip, totalSize } = summary;
  const c = picocolors;
  const columns = [
    { title: "产物", width: TABLE_NAME_WIDTH },
    { title: "类型", width: 7 },
    { title: "大小", width: 10 },
    ...(options.gzip ? [{ title: "gzip", width: 10 }] : []),
    ...(options.brotli ? [{ title: "brotli", width: 10 }] : []),
    { title: "占比", width: 7 },
    { title: "状态", width: 6 },
  ];
  const header = columns.map((column) => padEndDisplay(column.title, column.width)).join("  ");
  const separator = columns.map((column) => "─".repeat(column.width)).join("  ");
  const rows = sortAssets(assets).map((asset) => {
    const status = asset.size > options.warnSize ? c.yellow("warn") : c.green("ok");
    return [
      padEndDisplay(asset.name, TABLE_NAME_WIDTH),
      padEndDisplay(TYPE_LABEL[asset.type], 7),
      padStartDisplay(formatBytes(asset.size), 10),
      ...(options.gzip ? [padStartDisplay(formatOptionalBytes(asset.gzip), 10)] : []),
      ...(options.brotli ? [padStartDisplay(formatOptionalBytes(asset.brotli), 10)] : []),
      padStartDisplay(formatPercent(asset.size, totalSize), 7),
      padEndDisplay(status, 6),
    ].join("  ");
  });
  const foot: string[] = [`总计 ${formatBytes(totalSize)}`];
  if (options.gzip) foot.push(`gzip ${formatOptionalBytes(totalGzip)}`);
  if (options.brotli) foot.push(`brotli ${formatOptionalBytes(totalBrotli)}`);
  foot.push(`耗时 ${formatDuration(timing.total)}`);

  return [
    c.bold("产物清单"),
    c.gray(header),
    c.gray(separator),
    ...(rows.length > 0 ? rows : [c.gray("无构建产物")]),
    c.gray(separator),
    foot.join(" / "),
  ].join("\n");
}

function renderMinimal(summary: BuildSummary, options: ResolvedFormatOptions): string {
  const { assets, timing, totalBrotli, totalGzip, totalSize } = summary;
  const c = picocolors;
  const warningCount = assets.filter((asset) => asset.size > options.warnSize).length;
  const parts: string[] = [formatBytes(totalSize)];
  if (options.gzip) parts.push(`gzip ${formatOptionalBytes(totalGzip)}`);
  if (options.brotli) parts.push(`brotli ${formatOptionalBytes(totalBrotli)}`);
  if (warningCount > 0) parts.push(`${warningCount} warning${warningCount > 1 ? "s" : ""}`);
  return (
    `${c.green("✓ build done")}${c.gray(" · ")}` +
    `${formatDuration(timing.total)} · ${assets.length} assets · ${parts.join(" / ")}`
  );
}

function renderMetricRow(metrics: Array<[string, string]>): string {
  return metrics.map(([label, value]) => `${picocolors.gray(label)} ${value}`).join("  ");
}

function renderCompressionLine(
  totalSize: number,
  totalGzip: number | null,
  totalBrotli: number | null,
  options: ResolvedFormatOptions,
): string {
  const parts: string[] = [];
  if (options.gzip && totalGzip !== null) {
    parts.push(`gzip ${formatBytes(totalGzip)} (${formatPercent(totalGzip, totalSize)})`);
  }
  if (options.brotli && totalBrotli !== null) {
    parts.push(`brotli ${formatBytes(totalBrotli)} (${formatPercent(totalBrotli, totalSize)})`);
  }
  return parts.length > 0 ? `${picocolors.gray("压缩")} ${parts.join(" / ")}` : "";
}

function renderStages(stages: BuildSummary["timing"]["stages"]): string {
  if (!stages) return "";
  const parts: string[] = [];
  if (stages.transform !== undefined) parts.push(`transform ${formatDuration(stages.transform)}`);
  if (stages.bundle !== undefined) parts.push(`bundle ${formatDuration(stages.bundle)}`);
  return parts.length > 0 ? `${picocolors.gray("阶段")} ${parts.join(" / ")}` : "";
}

function renderTopAssets(
  assets: AssetRecord[],
  totalSize: number,
  options: ResolvedFormatOptions,
): string[] {
  const c = picocolors;
  return assets.map((asset, index) => {
    const rank = `${index + 1}.`;
    const name = padEndDisplay(asset.name, options.terminal === "pretty" ? 30 : 34);
    const size = padStartDisplay(formatBytes(asset.size), 9);
    const ratio = padStartDisplay(formatPercent(asset.size, totalSize), 7);
    const isWarn = asset.size > options.warnSize;
    const head = `${padStartDisplay(rank, 3)} ${name} ${size} ${ratio}`;
    if (options.terminal === "plain") {
      return isWarn ? c.yellow(` ${head}`) : ` ${head}`;
    }
    const { filled, empty } = renderBarParts(asset.size / (totalSize || 1), 14);
    const bar = `${c.cyan(filled)}${c.gray(empty)}`;
    return ` ${isWarn ? c.yellow(head) : head} ${bar}`;
  });
}

function renderGroups(
  assets: AssetRecord[],
  total: number,
  terminal: Exclude<TerminalMode, "auto">,
): string[] {
  const c = picocolors;
  const groups = new Map<AssetType, number>();
  for (const asset of assets) {
    groups.set(asset.type, (groups.get(asset.type) ?? 0) + asset.size);
  }
  return TYPE_ORDER.filter((type) => groups.has(type)).map((type) => {
    const size = groups.get(type) ?? 0;
    const base = ` ${padEndDisplay(TYPE_LABEL[type], 7)} ${padStartDisplay(formatBytes(size), 9)} ${padStartDisplay(formatPercent(size, total), 7)}`;
    if (terminal === "plain") return base;
    const { filled, empty } = renderBarParts(size / (total || 1), 12);
    return `${base} ${c.cyan(filled)}${c.gray(empty)}`;
  });
}

function renderDiff(diff: BuildDiff): string {
  const c = picocolors;
  const sign = (n: number) => (n > 0 ? "+" : "");
  const paint = (n: number, text: string) => (n > 0 ? c.red(text) : c.green(text));
  const sizeStr = paint(
    diff.totalSize,
    `${sign(diff.totalSize)}${formatBytes(Math.abs(diff.totalSize))}`,
  );
  const timeStr = c.gray(
    `${sign(diff.totalDuration)}${formatDuration(Math.abs(diff.totalDuration))}`,
  );
  const parts = [sizeStr];
  if (diff.totalGzip !== null) {
    parts.push(
      `gzip ${paint(diff.totalGzip, `${sign(diff.totalGzip)}${formatBytes(Math.abs(diff.totalGzip))}`)}`,
    );
  }
  parts.push(timeStr);
  return `${c.gray("对比上次")} ${parts.join(" / ")}`;
}

function renderBox(title: string, lines: string[]): string {
  const c = picocolors;
  const innerWidth = CARD_WIDTH - 4;
  const titleText = ` ${title} `;
  const top = `╭${titleText}${"─".repeat(Math.max(0, innerWidth - displayWidth(titleText)))}╮`;
  const bottom = `╰${"─".repeat(innerWidth)}╯`;
  const body = lines.map((line) => `│ ${padEndDisplay(line, innerWidth - 2)} │`);
  return ["", c.cyan(top), ...body, c.cyan(bottom)].join("\n");
}

function sortAssets(assets: AssetRecord[]): AssetRecord[] {
  return assets.slice().sort((a, b) => b.size - a.size || a.name.localeCompare(b.name));
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatOptionalBytes(bytes: number | null): string {
  return bytes === null ? "n/a" : formatBytes(bytes);
}

/** 估算终端显示宽度（先剥离 ANSI，CJK/全角/emoji 记 2 列，其余 1 列） */
function displayWidth(str: string): number {
  const stripped = stripAnsi(str);
  let width = 0;
  for (const char of stripped) {
    const code = char.codePointAt(0)!;
    const isWide =
      (code >= 0x1100 && code <= 0x115f) ||
      (code >= 0x2e80 && code <= 0x303e) ||
      (code >= 0x3040 && code <= 0x33bf) ||
      (code >= 0x3400 && code <= 0x4dbf) ||
      (code >= 0x4e00 && code <= 0xa4cf) ||
      (code >= 0xac00 && code <= 0xd7af) ||
      (code >= 0xf900 && code <= 0xfaff) ||
      (code >= 0xfe30 && code <= 0xfe6f) ||
      (code >= 0xff01 && code <= 0xff60) ||
      (code >= 0xffe0 && code <= 0xffe6) ||
      code >= 0x1f000;
    width += isWide ? 2 : 1;
  }
  return width;
}

/** 按显示宽度右填充空格，超长内容会用省略号截断 */
function padEndDisplay(str: string, target: number): string {
  const text = truncateDisplay(str, target);
  const pad = target - displayWidth(text);
  return pad > 0 ? `${text}${" ".repeat(pad)}` : text;
}

/** 按显示宽度左填充空格，超长内容会用省略号截断 */
function padStartDisplay(str: string, target: number): string {
  const text = truncateDisplay(str, target);
  const pad = target - displayWidth(text);
  return pad > 0 ? `${" ".repeat(pad)}${text}` : text;
}

function truncateDisplay(str: string, target: number): string {
  if (displayWidth(str) <= target) return str;
  if (target <= 1) return "…".slice(0, target);
  const suffix = "…";
  const suffixWidth = displayWidth(suffix);
  let width = 0;
  let result = "";
  const tokens = str.match(ANSI_TOKEN_RE) ?? [];
  let hasAnsi = false;
  for (const token of tokens) {
    if (token.startsWith(`${ESCAPE}[`)) {
      result += token;
      hasAnsi = true;
      continue;
    }
    const charWidth = displayWidth(token);
    if (width + charWidth + suffixWidth > target) break;
    result += token;
    width += charWidth;
  }
  return `${result}${suffix}${hasAnsi ? "\x1b[0m" : ""}`;
}

function stripAnsi(str: string): string {
  return str.replace(ANSI_RE, "");
}

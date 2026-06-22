import type { BudgetOptions, BudgetResult, BudgetViolation, BuildSummary } from "./types.ts";
import { formatBytes } from "./utils.ts";

/** 检查构建产物是否超出预算，返回超限项列表 */
export function checkBudget(summary: BuildSummary, budget: BudgetOptions): BudgetResult {
  const violations: BudgetViolation[] = [];

  if (budget.totalSize !== undefined && summary.totalSize > budget.totalSize) {
    violations.push({
      kind: "totalSize",
      actual: summary.totalSize,
      limit: budget.totalSize,
      message: `总大小 ${formatBytes(summary.totalSize)} > 预算 ${formatBytes(budget.totalSize)}`,
    });
  }

  if (budget.totalGzip !== undefined) {
    if (summary.totalGzip === null) {
      violations.push({
        kind: "totalGzip",
        actual: null,
        limit: budget.totalGzip,
        message: `未计算 gzip，无法校验总 gzip 预算 ${formatBytes(budget.totalGzip)}`,
      });
    } else if (summary.totalGzip > budget.totalGzip) {
      violations.push({
        kind: "totalGzip",
        actual: summary.totalGzip,
        limit: budget.totalGzip,
        message: `总 gzip ${formatBytes(summary.totalGzip)} > 预算 ${formatBytes(budget.totalGzip)}`,
      });
    }
  }

  const perAsset = budget.perAsset ?? budget.perChunk;
  if (perAsset !== undefined) {
    const over = summary.assets
      .filter((asset) => asset.size > perAsset)
      .sort((a, b) => b.size - a.size);
    for (const asset of over) {
      violations.push({
        kind: "perAsset",
        actual: asset.size,
        limit: perAsset,
        asset: asset.name,
        message: `${asset.name} ${formatBytes(asset.size)} > 单产物预算 ${formatBytes(perAsset)}`,
      });
    }
  }

  return {
    exceeded: violations.length > 0,
    violations,
    messages: violations.map((violation) => violation.message),
  };
}

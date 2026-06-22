<!--VITE PLUS START-->

# Using Vite+, the Unified Toolchain for the Web

This project is using Vite+, a unified toolchain built on top of Vite, Rolldown, Vitest, tsdown, Oxlint, Oxfmt, and Vite Task. Vite+ wraps runtime management, package management, and frontend tooling in a single global CLI called `vp`. Vite+ is distinct from Vite, and it invokes Vite through `vp dev` and `vp build`. Run `vp help` to print a list of commands and `vp <command> --help` for information about a specific command.

Docs are local at `node_modules/vite-plus/docs` or online at https://viteplus.dev/guide/.

## Review Checklist

- [ ] Run `vp install` after pulling remote changes and before getting started.
- [ ] Run `vp check` and `vp test` to format, lint, type check and test changes.
- [ ] Check if there are `vite.config.ts` tasks or `package.json` scripts necessary for validation, run via `vp run <script>`.
- [ ] If setup, runtime, or package-manager behavior looks wrong, run `vp env doctor` and include its output when asking for help.

<!--VITE PLUS END-->

# 项目说明（vite-plugin-build-reporter）

一个 Vite 插件，在 `vite build` 后把构建分析（耗时、产物体积、Top chunk、gzip/brotli、预算门禁、历史对比）打印到终端，**不生成任何报告文件**（纯内存、零文件；仅 `compare` 启用时写缓存）。同时兼容 Rollup 与 Rolldown 后端。

## 源码结构

| 文件               | 职责                                                             |
| ------------------ | ---------------------------------------------------------------- |
| `src/index.ts`     | 插件入口 `buildReporter()`，注册 Rollup 钩子、解析选项           |
| `src/collector.ts` | 收集产物，计算原始 / gzip / brotli 大小                          |
| `src/formatter.ts` | `formatReport` 分发到 `card` / `table` / `minimal` / `json` 渲染 |
| `src/budget.ts`    | `checkBudget` 预算门禁                                           |
| `src/storage.ts`   | 历史对比缓存读写（`last-build.json`）                            |
| `src/timer.ts`     | 构建阶段耗时                                                     |
| `src/types.ts`     | `BuildSummary` / `AssetRecord` / `BudgetResult` 等类型           |
| `src/utils.ts`     | `formatBytes` 等工具函数                                         |

## 关键约定（改动时请遵守）

- **Rollup 标准钩子**：用 `buildStart` / `renderStart` / `generateBundle` / `closeBundle`，不要引入 Vite 专属 API，以保证 Rollup 与 Rolldown 双后端兼容。
- **纯内存、零文件**：除 `compare` 启用外不写任何文件；门禁失败的构建不覆盖对比基线。
- **压缩字段语义**：`totalGzip` / `totalBrotli` 未测量时为 `null`，绝不回退为原始大小。
- **`perChunk` 是 `perAsset` 的兼容别名**，新代码统一用 `perAsset`。
- 改动 `src/` 下某模块时，同步更新 `tests/` 下对应测试（`vp test`）。

## 文档语言

README、代码注释、面向用户的终端输出文案使用**中文**；代码标识符保持英文。

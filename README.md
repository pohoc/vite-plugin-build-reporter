# vite-plugin-build-reporter

![CI](https://github.com/pohoc/vite-plugin-build-reporter/actions/workflows/ci.yml/badge.svg)

一个 Vite 插件，在 `vite build` 之后把构建分析打印到终端 —— **不生成任何报告文件**。

报告构建耗时、产物总体积（原始 / gzip / brotli）、Top chunk（含进度条）、按类型分类汇总、大文件告警、预算门禁，以及可选的历史对比。终端输出支持多种内容格式，并能在精美的 TTY 输出与 CI 友好的纯文本之间自动切换。

基于 Rollup 标准钩子构建，因此同时兼容 **Rollup** 与 **Rolldown** 后端（Vite / Vite+）。

## 安装

```bash
pnpm add -D vite-plugin-build-reporter
# 或
npm i -D vite-plugin-build-reporter
```

## 用法

```ts
// vite.config.ts
import { defineConfig } from "vite";
import { buildReporter } from "vite-plugin-build-reporter";

export default defineConfig({
  plugins: [buildReporter()],
});
```

运行 `vite build`，报告会打印到 stdout。

## 选项

```ts
buildReporter({
  enabled: true, // 总开关
  format: "card", // 'card' | 'table' | 'minimal' | 'json'
  terminal: "auto", // 'auto' | 'pretty' | 'plain'
  topN: 10, // Top N 排行数量
  groupByType: true, // 按类型分类汇总
  gzip: true, // 计算并显示 gzip 大小（同步 zlib 压缩）
  brotli: false, // brotli（同步压缩质量 9，默认关；显著增加构建时间，按需开启）
  includeSourceMaps: false, // 是否把 .map 文件计入统计
  warnSize: undefined, // 大文件告警阈值（字节）；默认联动 vite chunkSizeWarningLimit
  compare: false, // 历史对比（默认关闭，零文件）
  cacheDir: undefined, // 相对 Vite root 的对比缓存目录
  budget: undefined, // 预算门禁（超限可让构建失败）
  onReport: async (summary) => {}, // 可选的结构化报告回调
  log: (message) => console.log(message), // 自定义输出
});
```

| 选项                | 默认值                       | 说明                                                                               |
| ------------------- | ---------------------------- | ---------------------------------------------------------------------------------- |
| `enabled`           | `true`                       | 是否启用插件                                                                       |
| `format`            | `'card'`                     | 输出样式：`card` / `table` / `minimal` / `json`                                    |
| `terminal`          | `'auto'`                     | 终端渲染模式：`auto` 按 TTY/CI 判断，`pretty` 使用边框和进度条，`plain` 使用纯文本 |
| `topN`              | `10`                         | 排行显示的产物数量                                                                 |
| `groupByType`       | `true`                       | 是否输出 JS/CSS/字体/图片 分类汇总                                                 |
| `gzip`              | `true`                       | 是否计算并显示 gzip 大小（同步 zlib 压缩，大项目开启会略增构建时间）               |
| `brotli`            | `false`                      | 是否计算并显示 brotli 大小（同步压缩，质量 9，显著增加构建时间，按需开启）         |
| `includeSourceMaps` | `false`                      | 是否把 `.map` 文件计入产物、总量和预算统计；默认排除以避免放大线上体积             |
| `warnSize`          | vite `chunkSizeWarningLimit` | 超过该阈值的产物标记 ⚠（未设置时联动 vite 的 `build.chunkSizeWarningLimit`）       |
| `compare`           | `false`                      | 是否启用历史对比                                                                   |
| `cacheDir`          | `node_modules/.cache/...`    | 历史对比缓存，相对路径按 Vite `root` 解析                                          |
| `budget`            | `undefined`                  | 预算门禁配置                                                                       |
| `onReport`          | `undefined`                  | 结构化 `BuildSummary` 回调，可返回 Promise                                         |
| `log`               | `console.log`                | 单条报告文本的输出函数                                                             |

## 输出格式

- **`card`**（默认）：构建摘要 + 压缩率 + 阶段耗时 + Top N + 分类汇总 + 历史对比。
- **`table`**：列出全部产物（类型/大小/gzip/brotli/占比/状态），适合精细排查。
- **`minimal`**：单行摘要，CI 友好。
- **`json`**：输出单个结构化 JSON 文档（完整 `BuildSummary`），便于脚本/CI 消费。启用预算时，检查结果会嵌入 `budget`，不会再追加非 JSON 文本。

终端渲染模式单独控制：

- **`auto`**（默认）：TTY 中使用 `pretty`，CI / 非 TTY 中使用 `plain`。
- **`pretty`**：使用终端边框、对齐列与进度条，适合本地命令行查看。
- **`plain`**：不绘制边框，输出更适合 CI log、文件重定向与机器人消费。

## 预算门禁

预算门禁：设定上限，超限可让构建失败（在 CI 中防止体积回归）。

```ts
buildReporter({
  budget: {
    totalSize: 3 * 1024 * 1024, // 产物总大小上限 3MB
    totalGzip: 1 * 1024 * 1024, // 总 gzip 上限 1MB
    perAsset: 500 * 1024, // 单产物上限 500KB
    fail: true, // 超限让构建失败（默认 true）
  },
});
```

- `fail: true`（默认）：`closeBundle` 抛错，构建失败（退出非零）。
- `fail: false`：仅打印超限详情，不中断构建。
- `perChunk` 作为 `perAsset` 的兼容别名保留，新配置请使用 `perAsset`。
- 即使 `gzip: false`，配置 `budget.totalGzip` 时也会在内部计算 gzip，确保门禁不被绕过。

## 编程式上报

当结果需要被上传或被脚本消费、又不想解析终端文本时，使用 `onReport`：

```ts
buildReporter({
  onReport: async (summary) => {
    await metricsClient.publish("frontend-build", summary);
  },
});
```

回调会被 `await`。回调 reject 会导致构建失败。当某个压缩算法未测量时，对应的压缩字段为 `null`，绝不会用原始大小替代。

## CI / 非 TTY

插件检测 `process.stdout.isTTY` 与 `CI`：非交互环境自动改用纯文本（不画边框）。颜色遵循 `NO_COLOR`（https://no-color.org）与 `CI` 环境变量，自动降级为纯文本。无需额外配置。

## 历史对比

`compare` 默认关闭，插件是**纯内存、零文件**的。

启用 `compare: true` 后，插件会把上次构建的总量写入
`node_modules/.cache/vite-plugin-build-reporter/last-build.json`，下次构建对比显示 `+/-`。该路径以 Vite `root` 为基准。
该缓存位于 `node_modules`（天然不进 git、不是交付物），CI 可随时清理。

预算门禁失败的构建不会覆盖上一次成功构建的对比基线。watch 重建和多 `output` 构建都会重置状态并汇总本次所有产物。

## 开发

```bash
vp install
vp check
vp test run
vp pack
```

## 兼容性

- Vite 5 / 6 / 7 / 8（peer dependency）
- Rollup 与 Rolldown 后端（Vite+）—— 使用 `buildStart` / `renderStart` / `generateBundle` / `closeBundle` 标准钩子
- Node.js >= 20.19 / 22.12

## 许可证

MIT

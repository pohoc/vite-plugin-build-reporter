import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vite-plus/test";

test("runs through the real Vite build lifecycle", () => {
  const root = mkdtempSync(join(tmpdir(), "build-reporter-vite-"));
  try {
    const pluginEntry = fileURLToPath(new URL("../src/index.ts", import.meta.url));
    const projectRoot = dirname(fileURLToPath(new URL("../package.json", import.meta.url)));
    const entry = join(root, "src.ts");
    const config = join(root, "vite.config.ts");
    const report = join(root, "report.json");
    writeFileSync(entry, 'console.log("build reporter")');
    writeFileSync(
      config,
      `
        import { writeFileSync } from "node:fs"
        import { buildReporter } from ${JSON.stringify(pluginEntry)}
        export default {
          root: ${JSON.stringify(root)},
          logLevel: "silent",
          plugins: [buildReporter({
            format: "minimal",
            terminal: "plain",
            onReport: (summary) => writeFileSync(${JSON.stringify(report)}, JSON.stringify(summary)),
          })],
          build: {
            write: false,
            sourcemap: true,
            lib: { entry: ${JSON.stringify(entry)}, formats: ["es"], fileName: "fixture" },
          },
        }
      `,
    );

    const output = execFileSync("vp", ["build", "--config", config], {
      cwd: projectRoot,
      encoding: "utf8",
    });
    expect(output).toContain("build done");
    const summary = JSON.parse(readFileSync(report, "utf8")) as { assets: Array<{ name: string }> };
    expect(summary.assets.some((asset) => asset.name.endsWith(".map"))).toBe(false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

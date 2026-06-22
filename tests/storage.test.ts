import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test } from "vite-plus/test";
import { diffAgainst, readSnapshot, resolveCacheDir, writeSnapshot } from "../src/storage.ts";
import type { BuildSummary } from "../src/types.ts";

const directories: string[] = [];

afterEach(() => {
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

function temporaryDirectory(): string {
  const directory = mkdtempSync(join(tmpdir(), "build-reporter-"));
  directories.push(directory);
  return directory;
}

function summary(totalGzip: number | null): BuildSummary {
  return {
    timing: { total: 120 },
    assets: [],
    totalSize: 500,
    totalGzip,
    totalBrotli: null,
  };
}

test("resolveCacheDir resolves relative paths from Vite root", () => {
  expect(resolveCacheDir(".cache/reporter", "/project/root")).toBe("/project/root/.cache/reporter");
});

test("writeSnapshot and readSnapshot round-trip a versioned snapshot", () => {
  const directory = temporaryDirectory();
  expect(writeSnapshot(directory, { totalSize: 500, totalGzip: 100, duration: 120 })).toBe(true);
  expect(readSnapshot(directory)).toEqual({
    version: 1,
    totalSize: 500,
    totalGzip: 100,
    duration: 120,
  });
  expect(JSON.parse(readFileSync(join(directory, "last-build.json"), "utf8")).version).toBe(1);

  expect(writeSnapshot(directory, { totalSize: 600, totalGzip: null, duration: 130 })).toBe(true);
  expect(readSnapshot(directory)).toMatchObject({ totalSize: 600, totalGzip: null, duration: 130 });
});

test("readSnapshot rejects corrupt and unsupported snapshots", () => {
  const directory = temporaryDirectory();
  const file = join(directory, "last-build.json");
  writeFileSync(file, JSON.stringify({ version: 2, totalSize: 1, totalGzip: 1, duration: 1 }));
  expect(readSnapshot(directory)).toBeNull();
  writeFileSync(file, JSON.stringify({ totalSize: -1, totalGzip: 1, duration: 1 }));
  expect(readSnapshot(directory)).toBeNull();
});

test("readSnapshot migrates the unversioned v0 shape", () => {
  const directory = temporaryDirectory();
  writeFileSync(
    join(directory, "last-build.json"),
    JSON.stringify({ totalSize: 400, totalGzip: 90, duration: 100 }),
  );
  expect(readSnapshot(directory)).toEqual({
    version: 1,
    totalSize: 400,
    totalGzip: 90,
    duration: 100,
  });
});

test("diffAgainst omits gzip diff when either build did not measure it", () => {
  expect(
    diffAgainst(summary(null), { version: 1, totalSize: 400, totalGzip: 90, duration: 100 }),
  ).toEqual({ totalSize: 100, totalGzip: null, totalDuration: 20 });
});

import type { BuildTiming } from "./types.ts";

/**
 * 构建计时器：buildStart 开始，generateBundle 标记 bundle 起点，
 * closeBundle 结束，从而拆出 transform / bundle 两段。
 */
export class Timer {
  private startTime: number | null = null;
  private bundleStart: number | null = null;

  constructor(private readonly now: () => number = () => performance.now()) {}

  begin(): void {
    this.startTime = this.now();
    this.bundleStart = null;
  }

  markBundleStart(): void {
    if (this.startTime !== null && this.bundleStart === null) this.bundleStart = this.now();
  }

  done(): BuildTiming {
    if (this.startTime === null) return { total: 0 };

    const end = this.now();
    const start = this.startTime;
    const bundle = this.bundleStart;
    this.startTime = null;
    this.bundleStart = null;

    if (bundle !== null) {
      return {
        total: end - start,
        stages: {
          transform: bundle - start,
          bundle: end - bundle,
        },
      };
    }
    return { total: end - start };
  }
}

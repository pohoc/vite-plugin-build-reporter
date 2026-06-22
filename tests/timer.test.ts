import { expect, test } from "vite-plus/test";
import { Timer } from "../src/timer.ts";

test("Timer measures total duration", () => {
  let now = 10;
  const timer = new Timer(() => now);
  timer.begin();
  now = 35;
  expect(timer.done().total).toBe(25);
});

test("Timer reports total without bundle mark", () => {
  const timer = new Timer(() => 10);
  timer.begin();
  const timing = timer.done();
  expect(timing.stages).toBeUndefined();
  expect(timing.total).toBeGreaterThanOrEqual(0);
});

test("Timer splits stages when bundle marked", () => {
  let now = 10;
  const timer = new Timer(() => now);
  timer.begin();
  now = 25;
  timer.markBundleStart();
  now = 40;
  const timing = timer.done();
  expect(timing).toEqual({ total: 30, stages: { transform: 15, bundle: 15 } });
});

test("Timer resets bundle state between watch builds", () => {
  let now = 0;
  const timer = new Timer(() => now);
  timer.begin();
  now = 5;
  timer.markBundleStart();
  now = 10;
  timer.done();

  now = 20;
  timer.begin();
  now = 30;
  expect(timer.done()).toEqual({ total: 10 });
});

test("Timer is safe when done is called before begin", () => {
  expect(new Timer(() => 10).done()).toEqual({ total: 0 });
});

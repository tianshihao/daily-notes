import * as assert from "node:assert/strict";
import { AutoCommitScheduler } from "../src/git_service/auto_commit";

function setupTimer() {
  const timers = new Map<() => Promise<void>, number>();
  const scheduler = new AutoCommitScheduler((delay, callback) => {
    timers.set(callback, delay);
    return () => timers.delete(callback);
  });

  async function fire() {
    const callback = timers.keys().next().value;
    assert.ok(callback, "Expected a pending timer");
    timers.delete(callback);
    await callback();
  }

  return { scheduler, timers, fire };
}

suite("Automatic commits", () => {
  test("runs after one interval and waits for completion before scheduling another", async () => {
    const { scheduler, timers, fire } = setupTimer();
    let calls = 0;
    let finish!: () => void;
    scheduler.schedule(10, async () => {
      calls++;
      await new Promise<void>((resolve) => { finish = resolve; });
    });

    assert.equal(calls, 0);
    assert.deepEqual([...timers.values()], [600_000]);
    const running = fire();
    assert.equal(calls, 1);
    assert.equal(timers.size, 0);
    finish();
    await running;
    assert.deepEqual([...timers.values()], [600_000]);
    scheduler.dispose();
    assert.equal(timers.size, 0);
  });

  test("changing the interval during a commit schedules only the replacement", async () => {
    const { scheduler, timers, fire } = setupTimer();
    let finish!: () => void;
    const pending = new Promise<void>((resolve) => { finish = resolve; });
    let replacements = 0;
    scheduler.schedule(2, () => pending);
    const running = fire();
    scheduler.schedule(600, async () => { replacements++; });
    assert.equal(timers.size, 0);
    finish();
    await running;
    assert.deepEqual([...timers.values()], [36_000_000]);
    await fire();
    assert.equal(replacements, 1);
  });

  test("disabling automatic commits during a commit prevents the next one", async () => {
    const { scheduler, timers, fire } = setupTimer();
    let finish!: () => void;
    const pending = new Promise<void>((resolve) => { finish = resolve; });
    scheduler.schedule(2, () => pending);
    const running = fire();
    scheduler.dispose();
    finish();
    await running;
    assert.equal(timers.size, 0);
  });

  test("invalid intervals cancel an already pending timer", () => {
    const { scheduler, timers } = setupTimer();
    for (const minutes of [0, 1, 2.5, 601, Infinity, NaN]) {
      scheduler.schedule(2, async () => {});
      scheduler.schedule(minutes, async () => {});
      assert.equal(timers.size, 0);
    }
  });
});

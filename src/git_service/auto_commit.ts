type SetTimer = (milliseconds: number, callback: () => Promise<void>) => () => void;

const setTimer: SetTimer = (milliseconds, callback) => {
  const timer = setTimeout(() => { void callback(); }, milliseconds);
  return () => clearTimeout(timer);
};

export function isValidCommitInterval(minutes: number): boolean {
  return Number.isInteger(minutes) && minutes >= 2 && minutes <= 600;
}

export class AutoCommitScheduler {
  private settings?: { minutes: number; task: () => Promise<void> };
  private cancelTimer?: () => void;
  private running = false;

  constructor(private readonly startTimer: SetTimer = setTimer) { }

  schedule(minutes: number, task: () => Promise<void>): void {
    this.dispose();
    if (isValidCommitInterval(minutes)) {
      this.settings = { minutes, task };
      this.scheduleNext();
    }
  }

  dispose(): void {
    this.settings = undefined;
    this.cancelTimer?.();
    this.cancelTimer = undefined;
  }

  private scheduleNext(): void {
    const settings = this.settings;
    if (!settings || this.running) {
      return;
    }

    this.cancelTimer = this.startTimer(settings.minutes * 60_000, async () => {
      this.cancelTimer = undefined;
      this.running = true;
      try {
        await settings.task();
      } finally {
        this.running = false;
        this.scheduleNext();
      }
    });
  }
}

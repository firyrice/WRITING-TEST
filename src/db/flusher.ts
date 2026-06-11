type Sink<V> = (key: string, value: V) => Promise<void>;

/**
 * Per-key debounced writer. schedule() coalesces rapid updates; the latest
 * value for each key is written once after `delayMs`. flushImmediately() and
 * flushAll() bypass the timer for must-not-lose moments (done/error/unmount).
 */
export class Flusher<V> {
  private timers = new Map<string, ReturnType<typeof setTimeout>>();
  private pending = new Map<string, V>();

  constructor(private sink: Sink<V>, private delayMs: number) {}

  schedule(key: string, value: V): void {
    this.pending.set(key, value);
    if (this.timers.has(key)) return;
    const t = setTimeout(() => {
      this.timers.delete(key);
      const v = this.pending.get(key);
      if (v !== undefined) {
        this.pending.delete(key);
        void this.sink(key, v);
      }
    }, this.delayMs);
    this.timers.set(key, t);
  }

  async flushImmediately(key: string): Promise<void> {
    const t = this.timers.get(key);
    if (t) {
      clearTimeout(t);
      this.timers.delete(key);
    }
    const v = this.pending.get(key);
    if (v !== undefined) {
      this.pending.delete(key);
      await this.sink(key, v);
    }
  }

  async flushAll(): Promise<void> {
    const keys = Array.from(this.pending.keys());
    await Promise.all(keys.map((k) => this.flushImmediately(k)));
  }
}

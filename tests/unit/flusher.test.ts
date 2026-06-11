import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Flusher } from '@/db/flusher';

describe('Flusher', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('coalesces multiple schedule() calls into one flush', async () => {
    const sink = vi.fn().mockResolvedValue(undefined);
    const f = new Flusher(sink, 1500);
    f.schedule('k', { v: 1 });
    f.schedule('k', { v: 2 });
    f.schedule('k', { v: 3 });
    expect(sink).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1500);
    await Promise.resolve();
    expect(sink).toHaveBeenCalledTimes(1);
    expect(sink).toHaveBeenCalledWith('k', { v: 3 });
  });

  it('flushImmediately bypasses the timer and writes pending value', async () => {
    const sink = vi.fn().mockResolvedValue(undefined);
    const f = new Flusher(sink, 1500);
    f.schedule('k', { v: 1 });
    await f.flushImmediately('k');
    expect(sink).toHaveBeenCalledWith('k', { v: 1 });
  });

  it('different keys flush independently', async () => {
    const sink = vi.fn().mockResolvedValue(undefined);
    const f = new Flusher(sink, 1500);
    f.schedule('a', 1);
    f.schedule('b', 2);
    vi.advanceTimersByTime(1500);
    await Promise.resolve();
    expect(sink).toHaveBeenCalledWith('a', 1);
    expect(sink).toHaveBeenCalledWith('b', 2);
  });

  it('flushAll forces all pending keys', async () => {
    const sink = vi.fn().mockResolvedValue(undefined);
    const f = new Flusher(sink, 1500);
    f.schedule('a', 1);
    f.schedule('b', 2);
    await f.flushAll();
    expect(sink).toHaveBeenCalledTimes(2);
  });
});

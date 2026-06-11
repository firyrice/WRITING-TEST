import { describe, it, expect } from 'vitest';
import { parseSSEStream } from '@/services/sse';

function makeStream(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let i = 0;
  return new ReadableStream({
    pull(controller) {
      if (i >= chunks.length) {
        controller.close();
        return;
      }
      controller.enqueue(encoder.encode(chunks[i++]));
    },
  });
}

async function collectDeltas(stream: ReadableStream<Uint8Array>) {
  const deltas: string[] = [];
  await parseSSEStream(stream, (delta) => deltas.push(delta));
  return deltas;
}

describe('parseSSEStream', () => {
  it('parses a single complete event', async () => {
    const stream = makeStream([
      'data: {"choices":[{"delta":{"content":"hello"}}]}\n\n',
    ]);
    expect(await collectDeltas(stream)).toEqual(['hello']);
  });

  it('parses multiple events in one chunk', async () => {
    const stream = makeStream([
      'data: {"choices":[{"delta":{"content":"a"}}]}\n\n' +
        'data: {"choices":[{"delta":{"content":"b"}}]}\n\n',
    ]);
    expect(await collectDeltas(stream)).toEqual(['a', 'b']);
  });

  it('handles event split across chunks', async () => {
    const stream = makeStream([
      'data: {"choices":[{"delta":{"content":"hel',
      'lo"}}]}\n\n',
    ]);
    expect(await collectDeltas(stream)).toEqual(['hello']);
  });

  it('stops at [DONE] marker', async () => {
    const stream = makeStream([
      'data: {"choices":[{"delta":{"content":"x"}}]}\n\n' +
        'data: [DONE]\n\n' +
        'data: {"choices":[{"delta":{"content":"y"}}]}\n\n',
    ]);
    expect(await collectDeltas(stream)).toEqual(['x']);
  });

  it('skips malformed json lines without throwing', async () => {
    const stream = makeStream([
      'data: not-json\n\n' +
        'data: {"choices":[{"delta":{"content":"ok"}}]}\n\n',
    ]);
    expect(await collectDeltas(stream)).toEqual(['ok']);
  });

  it('ignores events without delta.content', async () => {
    const stream = makeStream([
      'data: {"choices":[{"delta":{"role":"assistant"}}]}\n\n' +
        'data: {"choices":[{"delta":{"content":"hi"}}]}\n\n',
    ]);
    expect(await collectDeltas(stream)).toEqual(['hi']);
  });
});

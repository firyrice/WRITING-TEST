/**
 * Parse a Server-Sent Events stream from an OpenAI-compatible chat completions
 * endpoint and forward each `choices[0].delta.content` chunk to onDelta.
 *
 * Stops at the `data: [DONE]` marker.
 * Tolerates malformed JSON lines (logs warning, continues).
 */
export async function parseSSEStream(
  stream: ReadableStream<Uint8Array>,
  onDelta: (delta: string) => void
): Promise<void> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let sepIndex: number;
      while ((sepIndex = buffer.indexOf('\n\n')) !== -1) {
        const block = buffer.slice(0, sepIndex);
        buffer = buffer.slice(sepIndex + 2);
        if (handleBlock(block, onDelta) === 'stop') return;
      }
    }
    // flush trailing buffer (rare)
    if (buffer.trim()) handleBlock(buffer, onDelta);
  } finally {
    reader.releaseLock();
  }
}

type BlockResult = 'continue' | 'stop';

function handleBlock(block: string, onDelta: (delta: string) => void): BlockResult {
  for (const line of block.split('\n')) {
    if (!line.startsWith('data:')) continue;
    const payload = line.slice(5).trim();
    if (payload === '[DONE]') return 'stop';
    try {
      const obj = JSON.parse(payload);
      const delta = obj?.choices?.[0]?.delta?.content;
      if (typeof delta === 'string' && delta.length > 0) onDelta(delta);
    } catch {
      console.warn('[sse] skipping malformed data line:', payload.slice(0, 80));
    }
  }
  return 'continue';
}

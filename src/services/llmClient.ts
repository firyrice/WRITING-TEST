import { parseSSEStream } from './sse';
import { LLMError } from './errors';
import type { ChatMessage, StreamOptions } from '@/types/llm';

/**
 * Call an OpenAI-compatible /chat/completions endpoint with stream=true.
 * Forwards every text delta to opts.onChunk and returns the full concatenated
 * text on completion. Throws LLMError on HTTP failures or AbortError on cancel.
 */
export async function streamChat(
  opts: StreamOptions
): Promise<{ fullText: string }> {
  const { modelId, messages, apiKey, baseUrl, signal, onChunk } = opts;

  const url = `${normalizeBaseUrl(baseUrl)}/chat/completions`;
  const resp = await fetch(url, {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: modelId,
      messages,
      stream: true,
    }),
  });

  if (!resp.ok) {
    const bodyText = await safeReadText(resp);
    const detail = bodyText.slice(0, 500) || `(empty body) url=${url}`;
    throw new LLMError(modelId, resp.status, detail);
  }
  if (!resp.body) {
    throw new LLMError(modelId, resp.status, 'no response body for stream');
  }

  let full = '';
  await parseSSEStream(resp.body, (delta) => {
    full += delta;
    onChunk(delta);
  });
  return { fullText: full };
}

/** Convenience for the writing phase. */
export function streamWriting(args: {
  modelId: string;
  systemPrompt: string;
  userPrompt: string;
  apiKey: string;
  baseUrl: string;
  signal: AbortSignal;
  onChunk: (delta: string) => void;
}): Promise<{ fullText: string }> {
  const messages: ChatMessage[] = [
    { role: 'system', content: args.systemPrompt },
    { role: 'user', content: args.userPrompt },
  ];
  return streamChat({
    modelId: args.modelId,
    messages,
    apiKey: args.apiKey,
    baseUrl: args.baseUrl,
    signal: args.signal,
    onChunk: args.onChunk,
  });
}

/** Convenience for the judging phase (single rendered prompt). */
export function streamJudging(args: {
  judgeModelId: string;
  judgePrompt: string;
  apiKey: string;
  baseUrl: string;
  signal: AbortSignal;
  onChunk: (delta: string) => void;
}): Promise<{ fullText: string }> {
  const messages: ChatMessage[] = [
    { role: 'user', content: args.judgePrompt },
  ];
  return streamChat({
    modelId: args.judgeModelId,
    messages,
    apiKey: args.apiKey,
    baseUrl: args.baseUrl,
    signal: args.signal,
    onChunk: args.onChunk,
  });
}

function normalizeBaseUrl(s: string): string {
  // 在浏览器中：明文 http:// 直连会触发 mixed content / CORS / 防火墙问题。
  // 自动改写为同源反代路径 /api/v1（Vite dev 反代到 llmapi.bilibili.co）
  if (typeof window !== 'undefined' && /^http:\/\//i.test(s)) {
    s = '/api/v1';
  }
  return s.endsWith('/') ? s.slice(0, -1) : s;
}

async function safeReadText(resp: Response): Promise<string> {
  try {
    return await resp.text();
  } catch {
    return '';
  }
}

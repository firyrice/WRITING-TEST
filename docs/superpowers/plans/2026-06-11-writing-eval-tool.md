# 写作领域 AI 模型评测工具 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建一个纯前端 SPA，让用户对 7 个写作 AI 模型同题写作、横向打分对比，并把任务持久化到 IndexedDB。

**Architecture:** React 19 + Vite + Tailwind 单页应用。services 层（纯逻辑、可单测）→ state 层（zustand + AbortController 编排）→ db 层（Dexie 封装 IndexedDB）→ pages 层（5 个路由）。LLM 走 fetch + ReadableStream 直接对接 OpenAI 兼容的 LLM Gateway。

**Tech Stack:** React 19 · Vite · TypeScript · Tailwind · zustand · Dexie · marked · react-router · Vitest · @testing-library/react · MSW

**Spec:** `docs/superpowers/specs/2026-06-11-writing-eval-tool-design.md`

---

## File Structure

```
src/
├── main.tsx, App.tsx, index.css       # 入口与路由
├── pages/                             # 5 个路由页（Home/New/Detail/History/Settings）
├── components/                        # UI 组件（ui/ 子目录是基础组件）
├── services/                          # 纯逻辑：LLM 调用、SSE 解析、prompt 渲染、别名映射
├── state/                             # zustand store + 任务编排（含 AbortController）
├── db/                                # Dexie schema + repo + 节流写盘
├── constants/                         # 模型清单 + 默认 prompt
└── lib/                               # 工具函数
tests/
├── unit/                              # services / db / state 单元测试
├── integration/                       # TaskDetailPage 完整流程
└── fixtures/                          # 测试数据
```

每个文件单一职责，services / db 层不依赖 React，可独立单测。

---

## Task 0: 项目脚手架

**Files:**
- Create: `package.json`
- Create: `vite.config.ts`
- Create: `tsconfig.json`, `tsconfig.node.json`
- Create: `tailwind.config.ts`, `postcss.config.js`
- Create: `index.html`
- Create: `.env.example`, `.gitignore`
- Create: `src/main.tsx`, `src/App.tsx`, `src/index.css`

- [ ] **Step 1: 初始化 package.json**

Create `package.json`:

```json
{
  "name": "writing-test",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "eslint . --ext .ts,.tsx"
  },
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-router-dom": "^7.0.0",
    "zustand": "^5.0.0",
    "dexie": "^4.0.0",
    "marked": "^14.0.0",
    "dompurify": "^3.1.0"
  },
  "devDependencies": {
    "@testing-library/react": "^16.0.0",
    "@testing-library/jest-dom": "^6.5.0",
    "@types/dompurify": "^3.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^4.3.0",
    "autoprefixer": "^10.4.0",
    "jsdom": "^25.0.0",
    "msw": "^2.6.0",
    "postcss": "^8.4.0",
    "tailwindcss": "^3.4.0",
    "typescript": "~5.6.0",
    "vite": "^6.0.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: 安装依赖**

Run: `pnpm install`
Expected: 依赖装好，无 ERESOLVE。如无 pnpm 用 `npm install`。

- [ ] **Step 3: 写 vite.config.ts（含反代）**

Create `vite.config.ts`:

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://llmapi.bilibili.co',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, ''),
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
  },
});
```

- [ ] **Step 4: 写 tsconfig**

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "types": ["vitest/globals", "@testing-library/jest-dom"],
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] }
  },
  "include": ["src", "tests"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

Create `tsconfig.node.json`:

```json
{
  "compilerOptions": {
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "skipLibCheck": true
  },
  "include": ["vite.config.ts"]
}
```

- [ ] **Step 5: 写 tailwind 配置**

Create `tailwind.config.ts`:

```ts
import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#5b6cff',
          dark: '#4955d6',
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
```

Create `postcss.config.js`:

```js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

- [ ] **Step 6: 入口文件**

Create `index.html`:

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>写作模型评测工具</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

Create `src/index.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

html, body, #root { height: 100%; }
body { @apply bg-white text-gray-900 font-sans antialiased; }
```

Create `src/main.tsx`:

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
);
```

Create `src/App.tsx`:

```tsx
export default function App() {
  return <div className="p-8">Hello Writing Test</div>;
}
```

- [ ] **Step 7: 写 .env.example 和 .gitignore**

Create `.env.example`:

```
VITE_LLM_API_KEY=bsk-xxxxxxxxxxxxxxxxxxxxxxxx
VITE_LLM_BASE_URL=/api/v1
```

Create `.gitignore`:

```
node_modules
dist
.env
.env.local
*.log
.DS_Store
```

- [ ] **Step 8: 验证 dev server 跑起来**

Run: `pnpm dev`
Expected: 浏览器打开 http://localhost:5173，显示 "Hello Writing Test"。Ctrl+C 停掉。

- [ ] **Step 9: 写 tests/setup.ts**

Create `tests/setup.ts`:

```ts
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 10: 跑一次空 test 确认 vitest 可用**

Run: `pnpm test`
Expected: "No test files found" 但配置正常退出 0。

- [ ] **Step 11: Commit**

```bash
git add .
git commit -m "chore: scaffold vite + react + tailwind project"
```

---

## Task 1: 类型定义

**Files:**
- Create: `src/types/task.ts`
- Create: `src/types/settings.ts`
- Create: `src/types/llm.ts`

- [ ] **Step 1: Task 类型**

Create `src/types/task.ts`:

```ts
export type TaskStatus =
  | 'idle'
  | 'writing'
  | 'writing_done'
  | 'judging'
  | 'done'
  | 'error';

export type CandidateStatus = 'pending' | 'streaming' | 'done' | 'error';

export type Candidate = {
  modelId: string;
  alias: string;
  status: CandidateStatus;
  article: string;
  startedAt?: number;
  finishedAt?: number;
  errorMessage?: string;
};

export type JudgeResult = {
  rawMarkdown: string;
  renderedAt: number;
  durationMs: number;
  error?: string;
};

export type Task = {
  id: string;
  createdAt: number;
  updatedAt: number;
  title: string;
  status: TaskStatus;
  writingPrompt: string;
  judgePrompt: string;
  judgeModel: string;
  anonymize: boolean;
  candidates: Candidate[];
  judgeResult?: JudgeResult;
};
```

- [ ] **Step 2: Settings 类型**

Create `src/types/settings.ts`:

```ts
export type Settings = {
  apiKey: string;
  apiBaseUrl: string;
  defaultWritingPrompt: string;
  defaultJudgePrompt: string;
  defaultSelectedModels: string[];
  defaultJudgeModel: string;
  defaultAnonymize: boolean;
};
```

- [ ] **Step 3: LLM 类型**

Create `src/types/llm.ts`:

```ts
export type ModelInfo = {
  id: string;
  label: string;
  family: string;
};

export type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

export type StreamOptions = {
  modelId: string;
  messages: ChatMessage[];
  apiKey: string;
  baseUrl: string;
  signal: AbortSignal;
  onChunk: (delta: string) => void;
};
```

- [ ] **Step 4: Commit**

```bash
git add src/types
git commit -m "feat(types): add task, settings, llm type definitions"
```

---

## Task 2: 常量（模型清单 + 默认 prompt）

**Files:**
- Create: `src/constants/models.ts`
- Create: `src/constants/defaultPrompts.ts`

- [ ] **Step 1: 模型清单**

Create `src/constants/models.ts`:

```ts
import type { ModelInfo } from '@/types/llm';

export const MODELS: ModelInfo[] = [
  { id: 'claude-4.7-opus',    label: 'Claude 4.7 Opus',    family: 'claude' },
  { id: 'claude-4.6-sonnet',  label: 'Claude 4.6 Sonnet',  family: 'claude' },
  { id: 'gemini-3.1-pro',     label: 'Gemini 3.1 Pro',     family: 'gemini' },
  { id: 'qwen3.7-max',        label: 'Qwen 3.7 Max',       family: 'qwen' },
  { id: 'deepseek-v4-pro',    label: 'DeepSeek V4 Pro',    family: 'deepseek' },
  { id: 'glm-5.1',            label: 'GLM 5.1',            family: 'glm' },
  { id: 'kimi-k2.6',          label: 'Kimi K2.6',          family: 'kimi' },
];

export const DEFAULT_JUDGE_MODEL = 'claude-4.7-opus';

export const MODEL_BY_ID: Record<string, ModelInfo> =
  Object.fromEntries(MODELS.map(m => [m.id, m]));
```

- [ ] **Step 2: 默认 prompt**

Create `src/constants/defaultPrompts.ts`:

```ts
export const DEFAULT_WRITING_SYSTEM_PROMPT = '你是一位专业的写作助手。';

export const DEFAULT_WRITING_PROMPT =
  '以「老去的城市」为题写一篇 800 字散文。';

export const DEFAULT_JUDGE_PROMPT = `你是一位资深的中文写作评测专家。下面是几位 AI 模型针对同一道写作题目交出的答卷，请你横向对比、打分并选出最佳。

## 写作题目
{{writing_prompt}}

## 各模型的作品
{{articles}}

请按以下要求输出 markdown 评测报告：

1. **评分总表**：用 markdown 表格，每行一个模型，列出 4 个维度的分数（10 分制）和总分（加权平均）：
   - 文采与语言表达
   - 逻辑、结构与主题切合
   - 创意与情感感染力
   - 可读性与事实准确性
2. **逐篇点评**：每个模型一段 100~200 字的具体评语，引用原文佐证。
3. **横向对比**：哪些模型擅长什么、短板在哪、风格差异。
4. **冠军与理由**：明确指出最佳模型，并给出 3 条核心理由。

请严格保持中立，不要因为模型名称（如出现）产生偏见。
若某模型标注为「生成失败」，请在评分中如实给出 0 分并在点评中说明。`;
```

- [ ] **Step 3: Commit**

```bash
git add src/constants
git commit -m "feat(constants): add model catalog and default prompts"
```

---

## Task 3: SSE 解析器（services/sse.ts）+ 测试

**Files:**
- Create: `src/services/sse.ts`
- Create: `tests/unit/sse.test.ts`

SSE 解析是 LLM 流式调用的核心，必须先单独写并测透——后续 llmClient 直接复用。

- [ ] **Step 1: 写 sse.test.ts 失败测试**

Create `tests/unit/sse.test.ts`:

```ts
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
```

- [ ] **Step 2: 跑测试看到红**

Run: `pnpm test sse`
Expected: FAIL，提示找不到 `@/services/sse`。

- [ ] **Step 3: 实现 sse.ts**

Create `src/services/sse.ts`:

```ts
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
```

- [ ] **Step 4: 跑测试看到绿**

Run: `pnpm test sse`
Expected: PASS, 6 tests passed.

- [ ] **Step 5: Commit**

```bash
git add src/services/sse.ts tests/unit/sse.test.ts
git commit -m "feat(services): add SSE parser with full test coverage"
```

---

## Task 4: 别名映射（aliasMap.ts）+ 测试

候选模型在送给评测者前要被匿名为 A/B/C/D...；评测报告渲染时再映射回真实模型名。这部分纯函数，独立可测。

**Files:**
- Create: `src/services/aliasMap.ts`
- Create: `tests/unit/aliasMap.test.ts`

- [ ] **Step 1: 写失败测试**

Create `tests/unit/aliasMap.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { assignAliases, applyAliasReplacement } from '@/services/aliasMap';

describe('assignAliases', () => {
  it('assigns A/B/C... to candidates in order', () => {
    const aliases = assignAliases(['claude-4.7-opus', 'gemini-3.1-pro', 'qwen3.7-max']);
    expect(aliases).toEqual({
      'claude-4.7-opus': '模型 A',
      'gemini-3.1-pro': '模型 B',
      'qwen3.7-max': '模型 C',
    });
  });

  it('returns empty for empty input', () => {
    expect(assignAliases([])).toEqual({});
  });

  it('extends past Z by repeating (AA, BB)', () => {
    const ids = Array.from({ length: 27 }, (_, i) => `m${i}`);
    const map = assignAliases(ids);
    expect(map['m0']).toBe('模型 A');
    expect(map['m25']).toBe('模型 Z');
    expect(map['m26']).toBe('模型 AA');
  });
});

describe('applyAliasReplacement', () => {
  const aliasToLabel: Record<string, string> = {
    '模型 A': 'Claude 4.7 Opus',
    '模型 B': 'Gemini 3.1 Pro',
  };

  it('replaces aliases with model labels in markdown', () => {
    const md = '## 模型 A\n模型 A 写得好。\n## 模型 B\n模型 B 一般。';
    expect(applyAliasReplacement(md, aliasToLabel)).toBe(
      '## Claude 4.7 Opus\nClaude 4.7 Opus 写得好。\n## Gemini 3.1 Pro\nGemini 3.1 Pro 一般。'
    );
  });

  it('does not match longer alias names like 模型 AB', () => {
    const md = '提到 模型 AB 不应被替换';
    const map = { '模型 A': 'Claude' };
    expect(applyAliasReplacement(md, map)).toBe('提到 模型 AB 不应被替换');
  });

  it('matches alias at end of string', () => {
    const map = { '模型 A': 'Claude' };
    expect(applyAliasReplacement('冠军：模型 A', map)).toBe('冠军：Claude');
  });

  it('returns input unchanged when no aliases match', () => {
    expect(applyAliasReplacement('hello world', { '模型 A': 'X' })).toBe('hello world');
  });
});
```

- [ ] **Step 2: 跑测试看到红**

Run: `pnpm test aliasMap`
Expected: FAIL，找不到 `@/services/aliasMap`。

- [ ] **Step 3: 实现 aliasMap.ts**

Create `src/services/aliasMap.ts`:

```ts
/**
 * Assign anonymous aliases (模型 A, 模型 B, ...) to a list of model IDs.
 * After Z, continues as AA, BB, CC (rare; we never have 27+ candidates in practice).
 */
export function assignAliases(modelIds: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  modelIds.forEach((id, i) => {
    out[id] = `模型 ${aliasLetter(i)}`;
  });
  return out;
}

function aliasLetter(index: number): string {
  if (index < 26) return String.fromCharCode(65 + index);
  // 26 -> AA, 27 -> BB, 28 -> CC ...
  const ch = String.fromCharCode(65 + ((index - 26) % 26));
  return ch + ch;
}

/**
 * Replace alias mentions in markdown with their human-readable model labels.
 *
 * Uses a negative lookahead on `[A-Z]` to avoid eating "模型 A" when "模型 AB"
 * is the actual token (defensive — current scheme uses single letters, but
 * supports the AA-style overflow as well).
 */
export function applyAliasReplacement(
  markdown: string,
  aliasToLabel: Record<string, string>
): string {
  // Sort by length desc so "模型 AA" matches before "模型 A".
  const entries = Object.entries(aliasToLabel).sort(
    ([a], [b]) => b.length - a.length
  );
  let out = markdown;
  for (const [alias, label] of entries) {
    const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // (?![A-Z]) prevents "模型 A" from matching inside "模型 AB"
    const re = new RegExp(escaped + '(?![A-Z])', 'g');
    out = out.replace(re, label);
  }
  return out;
}
```

- [ ] **Step 4: 跑测试看到绿**

Run: `pnpm test aliasMap`
Expected: PASS, 7 tests passed.

- [ ] **Step 5: Commit**

```bash
git add src/services/aliasMap.ts tests/unit/aliasMap.test.ts
git commit -m "feat(services): add alias map for anonymized judging"
```

---

## Task 5: Prompt 模板渲染（promptRender.ts）+ 测试

把 candidates 拼成评测者要看的"各模型作品"段落，并把 `{{writing_prompt}}` 与 `{{articles}}` 注入到 judge prompt 模板。

**Files:**
- Create: `src/services/promptRender.ts`
- Create: `tests/unit/promptRender.test.ts`

- [ ] **Step 1: 写失败测试**

Create `tests/unit/promptRender.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { renderJudgePrompt, renderArticlesBlock } from '@/services/promptRender';
import type { Candidate } from '@/types/task';

const baseCandidate = (over: Partial<Candidate>): Candidate => ({
  modelId: 'm',
  alias: '模型 X',
  status: 'done',
  article: '',
  ...over,
});

describe('renderArticlesBlock', () => {
  it('formats successful candidates with alias', () => {
    const cands: Candidate[] = [
      baseCandidate({ alias: '模型 A', article: '文章一' }),
      baseCandidate({ alias: '模型 B', article: '文章二' }),
    ];
    const out = renderArticlesBlock(cands);
    expect(out).toContain('## 模型 A 的作品');
    expect(out).toContain('文章一');
    expect(out).toContain('## 模型 B 的作品');
    expect(out).toContain('文章二');
    expect(out.indexOf('模型 A')).toBeLessThan(out.indexOf('模型 B'));
  });

  it('marks failed candidates explicitly', () => {
    const cands: Candidate[] = [
      baseCandidate({ alias: '模型 A', status: 'error', errorMessage: 'HTTP 500', article: '' }),
    ];
    const out = renderArticlesBlock(cands);
    expect(out).toContain('## 模型 A 的作品');
    expect(out).toContain('（生成失败：HTTP 500）');
  });

  it('marks done-but-empty candidates as failed too', () => {
    const cands: Candidate[] = [
      baseCandidate({ alias: '模型 A', status: 'done', article: '' }),
    ];
    expect(renderArticlesBlock(cands)).toContain('（生成失败');
  });
});

describe('renderJudgePrompt', () => {
  const tpl = '题目：{{writing_prompt}}\n作品：\n{{articles}}\n请评分。';

  it('replaces both placeholders', () => {
    const cands: Candidate[] = [baseCandidate({ alias: '模型 A', article: 'foo' })];
    const out = renderJudgePrompt(tpl, '老去的城市', cands);
    expect(out).toContain('题目：老去的城市');
    expect(out).toContain('## 模型 A 的作品');
    expect(out).toContain('foo');
    expect(out).not.toContain('{{writing_prompt}}');
    expect(out).not.toContain('{{articles}}');
  });

  it('replaces every occurrence of placeholders', () => {
    const t = '{{writing_prompt}} {{writing_prompt}}';
    const out = renderJudgePrompt(t, 'X', []);
    expect(out).toBe('X X');
  });
});
```

- [ ] **Step 2: 跑测试看到红**

Run: `pnpm test promptRender`
Expected: FAIL.

- [ ] **Step 3: 实现 promptRender.ts**

Create `src/services/promptRender.ts`:

```ts
import type { Candidate } from '@/types/task';

/**
 * Render the `## <alias> 的作品` block for all candidates, in declaration order.
 * Failed or empty-output candidates are emitted with an explicit "生成失败" marker.
 */
export function renderArticlesBlock(candidates: Candidate[]): string {
  return candidates
    .map((c) => {
      const heading = `## ${c.alias} 的作品`;
      const body =
        c.status === 'error' || c.article.trim() === ''
          ? `（生成失败：${c.errorMessage ?? '无内容输出'}）`
          : `<article>\n${c.article}\n</article>`;
      return `${heading}\n${body}`;
    })
    .join('\n\n');
}

/**
 * Render the full judge prompt by substituting {{writing_prompt}} and
 * {{articles}}. Both placeholders are replaced in every occurrence.
 */
export function renderJudgePrompt(
  template: string,
  writingPrompt: string,
  candidates: Candidate[]
): string {
  return template
    .split('{{writing_prompt}}')
    .join(writingPrompt)
    .split('{{articles}}')
    .join(renderArticlesBlock(candidates));
}
```

- [ ] **Step 4: 跑测试看到绿**

Run: `pnpm test promptRender`
Expected: PASS, 5 tests passed.

- [ ] **Step 5: Commit**

```bash
git add src/services/promptRender.ts tests/unit/promptRender.test.ts
git commit -m "feat(services): add judge prompt template renderer"
```

---

## Task 6: LLM 错误类 + LLM 客户端（llmClient.ts）

把上面 sse 解析包成完整的 chat 流式调用。

**Files:**
- Create: `src/services/errors.ts`
- Create: `src/services/llmClient.ts`

- [ ] **Step 1: errors.ts**

Create `src/services/errors.ts`:

```ts
export class LLMError extends Error {
  constructor(
    public modelId: string,
    public status: number,
    public bodyExcerpt: string,
    message?: string
  ) {
    super(message ?? `LLM ${modelId} HTTP ${status}: ${bodyExcerpt}`);
    this.name = 'LLMError';
  }
}
```

- [ ] **Step 2: llmClient.ts**

Create `src/services/llmClient.ts`:

```ts
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

  const url = `${stripTrailingSlash(baseUrl)}/chat/completions`;
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
    throw new LLMError(modelId, resp.status, bodyText.slice(0, 500));
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

function stripTrailingSlash(s: string): string {
  return s.endsWith('/') ? s.slice(0, -1) : s;
}

async function safeReadText(resp: Response): Promise<string> {
  try {
    return await resp.text();
  } catch {
    return '';
  }
}
```

- [ ] **Step 3: 类型 check 通过**

Run: `pnpm exec tsc -b --noEmit`
Expected: 无错误。

- [ ] **Step 4: Commit**

```bash
git add src/services/errors.ts src/services/llmClient.ts
git commit -m "feat(services): add llm streaming client (writing + judging)"
```

---

## Task 7: Dexie schema + taskRepo + 测试

**Files:**
- Create: `src/db/schema.ts`
- Create: `src/db/taskRepo.ts`
- Create: `tests/unit/taskRepo.test.ts`

- [ ] **Step 1: schema.ts**

Create `src/db/schema.ts`:

```ts
import Dexie, { type Table } from 'dexie';
import type { Task } from '@/types/task';
import type { Settings } from '@/types/settings';

export class AppDB extends Dexie {
  tasks!: Table<Task, string>;
  settings!: Table<Settings & { id: 'singleton' }, string>;

  constructor(name = 'writing-test-db') {
    super(name);
    this.version(1).stores({
      tasks: 'id, createdAt, status',
      settings: 'id',
    });
  }
}

export const db = new AppDB();
```

- [ ] **Step 2: 写 taskRepo.test.ts 失败测试**

Create `tests/unit/taskRepo.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { AppDB } from '@/db/schema';
import { TaskRepo } from '@/db/taskRepo';
import type { Task } from '@/types/task';

const sampleTask = (over: Partial<Task> = {}): Task => ({
  id: 'task-1',
  createdAt: 1000,
  updatedAt: 1000,
  title: 'Test',
  status: 'idle',
  writingPrompt: 'write something',
  judgePrompt: 'judge it',
  judgeModel: 'claude-4.7-opus',
  anonymize: true,
  candidates: [],
  ...over,
});

describe('TaskRepo', () => {
  let repo: TaskRepo;

  beforeEach(async () => {
    const db = new AppDB('test-db-' + Math.random());
    repo = new TaskRepo(db);
  });

  it('creates and retrieves a task', async () => {
    await repo.create(sampleTask());
    expect(await repo.get('task-1')).toMatchObject({ title: 'Test', status: 'idle' });
  });

  it('returns undefined for missing task', async () => {
    expect(await repo.get('nope')).toBeUndefined();
  });

  it('lists tasks ordered by createdAt desc', async () => {
    await repo.create(sampleTask({ id: 'a', createdAt: 100 }));
    await repo.create(sampleTask({ id: 'b', createdAt: 200 }));
    await repo.create(sampleTask({ id: 'c', createdAt: 150 }));
    const list = await repo.listAll();
    expect(list.map(t => t.id)).toEqual(['b', 'c', 'a']);
  });

  it('updates an existing task', async () => {
    await repo.create(sampleTask());
    await repo.update('task-1', { status: 'done', updatedAt: 2000 });
    expect(await repo.get('task-1')).toMatchObject({ status: 'done', updatedAt: 2000 });
  });

  it('deletes a task', async () => {
    await repo.create(sampleTask());
    await repo.delete('task-1');
    expect(await repo.get('task-1')).toBeUndefined();
  });

  it('exports and imports tasks losslessly', async () => {
    const t = sampleTask({ candidates: [{ modelId: 'm', alias: '模型 A', status: 'done', article: 'hi' }] });
    await repo.create(t);
    const exported = await repo.exportAll();

    const repo2 = new TaskRepo(new AppDB('test-db-imp-' + Math.random()));
    await repo2.importAll(exported);
    expect(await repo2.get('task-1')).toEqual(t);
  });

  it('importAll upserts (overwrites existing ids)', async () => {
    await repo.create(sampleTask({ title: 'Old' }));
    await repo.importAll([sampleTask({ title: 'New' })]);
    expect((await repo.get('task-1'))!.title).toBe('New');
  });
});
```

Add `fake-indexeddb` to devDependencies — modify `package.json`'s devDependencies block:

```json
"fake-indexeddb": "^6.0.0"
```

Run: `pnpm install`

- [ ] **Step 3: 跑测试看到红**

Run: `pnpm test taskRepo`
Expected: FAIL.

- [ ] **Step 4: 实现 taskRepo.ts**

Create `src/db/taskRepo.ts`:

```ts
import type { Task } from '@/types/task';
import type { AppDB } from './schema';

export class TaskRepo {
  constructor(private db: AppDB) {}

  async create(task: Task): Promise<void> {
    await this.db.tasks.add(task);
  }

  async get(id: string): Promise<Task | undefined> {
    return this.db.tasks.get(id);
  }

  async listAll(): Promise<Task[]> {
    const all = await this.db.tasks.toArray();
    return all.sort((a, b) => b.createdAt - a.createdAt);
  }

  async update(id: string, patch: Partial<Task>): Promise<void> {
    await this.db.tasks.update(id, patch);
  }

  async delete(id: string): Promise<void> {
    await this.db.tasks.delete(id);
  }

  async exportAll(): Promise<Task[]> {
    return this.db.tasks.toArray();
  }

  async importAll(tasks: Task[]): Promise<void> {
    await this.db.tasks.bulkPut(tasks);
  }
}
```

- [ ] **Step 5: 跑测试看到绿**

Run: `pnpm test taskRepo`
Expected: PASS, 7 tests passed.

- [ ] **Step 6: Commit**

```bash
git add src/db tests/unit/taskRepo.test.ts package.json
git commit -m "feat(db): add Dexie schema and TaskRepo with full test coverage"
```

---

## Task 8: 节流 flusher（flusher.ts）

写作过程中候选 article 会高频追加，不能每次都 flush 到 IndexedDB。这是个独立的小工具。

**Files:**
- Create: `src/db/flusher.ts`
- Create: `tests/unit/flusher.test.ts`

- [ ] **Step 1: 写失败测试**

Create `tests/unit/flusher.test.ts`:

```ts
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
```

- [ ] **Step 2: 跑测试看到红**

Run: `pnpm test flusher`
Expected: FAIL.

- [ ] **Step 3: 实现 flusher.ts**

Create `src/db/flusher.ts`:

```ts
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
```

- [ ] **Step 4: 跑测试看到绿**

Run: `pnpm test flusher`
Expected: PASS, 4 tests passed.

- [ ] **Step 5: Commit**

```bash
git add src/db/flusher.ts tests/unit/flusher.test.ts
git commit -m "feat(db): add per-key debounced flusher"
```

---

## Task 9: Settings store（settingsStore.ts）

zustand store 管理设置；apiKey 优先 localStorage > 环境变量。

**Files:**
- Create: `src/state/settingsStore.ts`
- Create: `src/lib/id.ts`
- Create: `src/lib/format.ts`

- [ ] **Step 1: id.ts 工具**

Create `src/lib/id.ts`:

```ts
export function uuid(): string {
  // 在 modern 浏览器和 jsdom 里 crypto.randomUUID 都可用
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}
```

- [ ] **Step 2: format.ts 工具**

Create `src/lib/format.ts`:

```ts
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m${Math.floor((ms % 60000) / 1000)}s`;
}

export function formatTime(ts: number): string {
  return new Date(ts).toLocaleString('zh-CN', { hour12: false });
}

export function countChars(s: string): number {
  // 中文按字数计；非中文也按字符数计；够用即可
  return Array.from(s).length;
}

export function maskApiKey(key: string): string {
  if (!key) return '';
  if (key.length <= 8) return '*'.repeat(key.length);
  return key.slice(0, 8) + '•'.repeat(Math.max(0, key.length - 11)) + key.slice(-3);
}
```

- [ ] **Step 3: settingsStore.ts**

Create `src/state/settingsStore.ts`:

```ts
import { create } from 'zustand';
import type { Settings } from '@/types/settings';
import {
  DEFAULT_JUDGE_PROMPT,
  DEFAULT_WRITING_PROMPT,
} from '@/constants/defaultPrompts';
import { DEFAULT_JUDGE_MODEL, MODELS } from '@/constants/models';

const LS_KEY = 'writing-test:settings';

function readEnv(name: string, fallback: string): string {
  // Vite 的 import.meta.env 在测试环境也存在；缺失就 fallback
  return ((import.meta as any).env?.[name] as string | undefined) ?? fallback;
}

function loadInitial(): Settings {
  const fromEnvKey = readEnv('VITE_LLM_API_KEY', '');
  const fromEnvBase = readEnv('VITE_LLM_BASE_URL', '/api/v1');
  let stored: Partial<Settings> = {};
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(LS_KEY) : null;
    if (raw) stored = JSON.parse(raw);
  } catch {
    // ignore
  }
  return {
    apiKey: stored.apiKey ?? fromEnvKey,
    apiBaseUrl: stored.apiBaseUrl ?? fromEnvBase,
    defaultWritingPrompt: stored.defaultWritingPrompt ?? DEFAULT_WRITING_PROMPT,
    defaultJudgePrompt: stored.defaultJudgePrompt ?? DEFAULT_JUDGE_PROMPT,
    defaultSelectedModels:
      stored.defaultSelectedModels ?? MODELS.slice(0, 3).map((m) => m.id),
    defaultJudgeModel: stored.defaultJudgeModel ?? DEFAULT_JUDGE_MODEL,
    defaultAnonymize: stored.defaultAnonymize ?? true,
  };
}

function persist(s: Settings) {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LS_KEY, JSON.stringify(s));
    }
  } catch {
    // ignore
  }
}

type SettingsStore = {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
  resetJudgePrompt: () => void;
};

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  settings: loadInitial(),
  update: (patch) => {
    const next = { ...get().settings, ...patch };
    persist(next);
    set({ settings: next });
  },
  resetJudgePrompt: () => {
    const next = { ...get().settings, defaultJudgePrompt: DEFAULT_JUDGE_PROMPT };
    persist(next);
    set({ settings: next });
  },
}));
```

- [ ] **Step 4: 类型 check 通过**

Run: `pnpm exec tsc -b --noEmit`
Expected: 无错误。

- [ ] **Step 5: Commit**

```bash
git add src/state/settingsStore.ts src/lib
git commit -m "feat(state): add settings store with localStorage + env fallback"
```

---

## Task 10: Task store（taskStore.ts）

zustand store 管理"当前在内存里活动的任务"，提供细粒度 dispatch（appendDelta / markCandidateDone 等）。Repo 层 hydration 由 store 触发。

**Files:**
- Create: `src/state/taskStore.ts`

- [ ] **Step 1: 实现 taskStore.ts**

Create `src/state/taskStore.ts`:

```ts
import { create } from 'zustand';
import type { Task, TaskStatus, Candidate, JudgeResult } from '@/types/task';
import { TaskRepo } from '@/db/taskRepo';
import { db } from '@/db/schema';
import { Flusher } from '@/db/flusher';

const repo = new TaskRepo(db);

const flusher = new Flusher<Task>(async (id, task) => {
  await repo.update(id, { ...task, updatedAt: Date.now() });
}, 1500);

type TaskStore = {
  /** Currently loaded task in memory; null when no task is open. */
  current: Task | null;
  /** All tasks for the history list. */
  list: Task[];

  loadList: () => Promise<void>;
  loadTask: (id: string) => Promise<Task | null>;
  saveNew: (task: Task) => Promise<void>;
  setStatus: (id: string, status: TaskStatus) => void;
  appendDelta: (id: string, modelId: string, delta: string) => void;
  setCandidateStreaming: (id: string, modelId: string) => void;
  markCandidateDone: (id: string, modelId: string, full: string) => void;
  markCandidateError: (id: string, modelId: string, message: string) => void;
  setJudgeResult: (id: string, result: JudgeResult) => void;
  appendJudgeDelta: (id: string, delta: string) => void;
  startJudgeStream: (id: string) => void;
  flushNow: (id: string) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
};

function patchCurrent(get: () => TaskStore, set: (p: Partial<TaskStore>) => void, id: string, fn: (t: Task) => Task) {
  const cur = get().current;
  if (!cur || cur.id !== id) return;
  const next = fn(cur);
  set({ current: next });
  flusher.schedule(id, next);
}

export const useTaskStore = create<TaskStore>((set, get) => ({
  current: null,
  list: [],

  async loadList() {
    set({ list: await repo.listAll() });
  },

  async loadTask(id) {
    const t = await repo.get(id);
    set({ current: t ?? null });
    return t ?? null;
  },

  async saveNew(task) {
    await repo.create(task);
    set({ current: task });
    set({ list: await repo.listAll() });
  },

  setStatus(id, status) {
    patchCurrent(get, set, id, (t) => ({ ...t, status }));
  },

  setCandidateStreaming(id, modelId) {
    patchCurrent(get, set, id, (t) => ({
      ...t,
      candidates: t.candidates.map((c) =>
        c.modelId === modelId
          ? { ...c, status: 'streaming', startedAt: c.startedAt ?? Date.now() }
          : c
      ),
    }));
  },

  appendDelta(id, modelId, delta) {
    patchCurrent(get, set, id, (t) => ({
      ...t,
      candidates: t.candidates.map((c) =>
        c.modelId === modelId ? { ...c, article: c.article + delta } : c
      ),
    }));
  },

  markCandidateDone(id, modelId, full) {
    patchCurrent(get, set, id, (t) => ({
      ...t,
      candidates: t.candidates.map((c) =>
        c.modelId === modelId
          ? { ...c, status: 'done', article: full, finishedAt: Date.now() }
          : c
      ),
    }));
    void flusher.flushImmediately(id);
  },

  markCandidateError(id, modelId, message) {
    patchCurrent(get, set, id, (t) => ({
      ...t,
      candidates: t.candidates.map((c) =>
        c.modelId === modelId
          ? { ...c, status: 'error', errorMessage: message, finishedAt: Date.now() }
          : c
      ),
    }));
    void flusher.flushImmediately(id);
  },

  startJudgeStream(id) {
    patchCurrent(get, set, id, (t) => ({
      ...t,
      status: 'judging',
      judgeResult: { rawMarkdown: '', renderedAt: Date.now(), durationMs: 0 },
    }));
  },

  appendJudgeDelta(id, delta) {
    patchCurrent(get, set, id, (t) => ({
      ...t,
      judgeResult: t.judgeResult
        ? { ...t.judgeResult, rawMarkdown: t.judgeResult.rawMarkdown + delta }
        : t.judgeResult,
    }));
  },

  setJudgeResult(id, result) {
    patchCurrent(get, set, id, (t) => ({ ...t, judgeResult: result, status: 'done' }));
    void flusher.flushImmediately(id);
  },

  async flushNow(id) {
    await flusher.flushImmediately(id);
  },

  async deleteTask(id) {
    await repo.delete(id);
    if (get().current?.id === id) set({ current: null });
    set({ list: await repo.listAll() });
  },
}));
```

- [ ] **Step 2: 类型 check 通过**

Run: `pnpm exec tsc -b --noEmit`
Expected: 无错误。

- [ ] **Step 3: Commit**

```bash
git add src/state/taskStore.ts
git commit -m "feat(state): add task store with debounced flush"
```

---

## Task 11: Task runner（taskRunner.ts）+ 测试

并发编排核心：管理 AbortController、跑写作 phase、跑 judging phase、单候选重试。

**Files:**
- Create: `src/state/taskRunner.ts`
- Create: `tests/unit/taskRunner.test.ts`

- [ ] **Step 1: 写失败测试**

Create `tests/unit/taskRunner.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { TaskRunner } from '@/state/taskRunner';
import { useTaskStore } from '@/state/taskStore';
import { useSettingsStore } from '@/state/settingsStore';
import type { Task } from '@/types/task';

vi.mock('@/services/llmClient', () => ({
  streamWriting: vi.fn(),
  streamJudging: vi.fn(),
}));

import { streamWriting, streamJudging } from '@/services/llmClient';

const sample: Task = {
  id: 'tid',
  createdAt: 0,
  updatedAt: 0,
  title: '',
  status: 'idle',
  writingPrompt: 'p',
  judgePrompt: '题目：{{writing_prompt}}\n{{articles}}',
  judgeModel: 'judge',
  anonymize: true,
  candidates: [
    { modelId: 'm1', alias: '模型 A', status: 'pending', article: '' },
    { modelId: 'm2', alias: '模型 B', status: 'pending', article: '' },
  ],
};

describe('TaskRunner.runWriting', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    useTaskStore.setState({ current: null, list: [] });
    useSettingsStore.setState({
      settings: {
        apiKey: 'k', apiBaseUrl: '/api/v1',
        defaultWritingPrompt: '', defaultJudgePrompt: '',
        defaultSelectedModels: [], defaultJudgeModel: 'judge', defaultAnonymize: true,
      },
    } as any);
    await useTaskStore.getState().saveNew(structuredClone(sample));
  });

  it('moves status to writing_done after all candidates settle', async () => {
    (streamWriting as any).mockImplementation(async ({ onChunk, modelId }) => {
      onChunk('hello-' + modelId);
      return { fullText: 'hello-' + modelId };
    });
    const runner = new TaskRunner();
    await runner.runWriting('tid');
    const t = useTaskStore.getState().current!;
    expect(t.status).toBe('writing_done');
    expect(t.candidates.every((c) => c.status === 'done')).toBe(true);
    expect(t.candidates[0].article).toBe('hello-m1');
  });

  it('marks failed candidate but still reaches writing_done', async () => {
    (streamWriting as any).mockImplementation(async ({ modelId, onChunk }) => {
      if (modelId === 'm1') throw new Error('boom');
      onChunk('ok');
      return { fullText: 'ok' };
    });
    const runner = new TaskRunner();
    await runner.runWriting('tid');
    const t = useTaskStore.getState().current!;
    expect(t.status).toBe('writing_done');
    expect(t.candidates[0].status).toBe('error');
    expect(t.candidates[0].errorMessage).toContain('boom');
    expect(t.candidates[1].status).toBe('done');
  });

  it('cancelWriting aborts in-flight requests', async () => {
    (streamWriting as any).mockImplementation(async ({ signal }: { signal: AbortSignal }) => {
      await new Promise((_, reject) => {
        signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
      });
      return { fullText: '' };
    });
    const runner = new TaskRunner();
    const p = runner.runWriting('tid');
    runner.cancelWriting('tid');
    await p;
    const t = useTaskStore.getState().current!;
    expect(t.status).toBe('writing_done'); // settled (errored), still done
    expect(t.candidates.every((c) => c.status === 'error')).toBe(true);
  });
});

describe('TaskRunner.runJudging', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    useTaskStore.setState({ current: null, list: [] });
    useSettingsStore.setState({
      settings: {
        apiKey: 'k', apiBaseUrl: '/api/v1',
        defaultWritingPrompt: '', defaultJudgePrompt: '',
        defaultSelectedModels: [], defaultJudgeModel: 'judge', defaultAnonymize: true,
      },
    } as any);
    const t = structuredClone(sample);
    t.status = 'writing_done';
    t.candidates[0] = { ...t.candidates[0], status: 'done', article: '文一' };
    t.candidates[1] = { ...t.candidates[1], status: 'done', article: '文二' };
    await useTaskStore.getState().saveNew(t);
  });

  it('streams the judge response and marks task done', async () => {
    (streamJudging as any).mockImplementation(async ({ onChunk }) => {
      onChunk('# 报告\n');
      onChunk('内容');
      return { fullText: '# 报告\n内容' };
    });
    const runner = new TaskRunner();
    await runner.runJudging('tid');
    const t = useTaskStore.getState().current!;
    expect(t.status).toBe('done');
    expect(t.judgeResult?.rawMarkdown).toBe('# 报告\n内容');
  });

  it('records error on judging failure but does not corrupt candidates', async () => {
    (streamJudging as any).mockRejectedValue(new Error('judge-fail'));
    const runner = new TaskRunner();
    await runner.runJudging('tid');
    const t = useTaskStore.getState().current!;
    expect(t.judgeResult?.error).toContain('judge-fail');
    expect(t.candidates.every((c) => c.status === 'done')).toBe(true);
  });
});
```

- [ ] **Step 2: 跑测试看到红**

Run: `pnpm test taskRunner`
Expected: FAIL.

- [ ] **Step 3: 实现 taskRunner.ts**

Create `src/state/taskRunner.ts`:

```ts
import { streamWriting, streamJudging } from '@/services/llmClient';
import { renderJudgePrompt } from '@/services/promptRender';
import { DEFAULT_WRITING_SYSTEM_PROMPT } from '@/constants/defaultPrompts';
import { useSettingsStore } from './settingsStore';
import { useTaskStore } from './taskStore';

export class TaskRunner {
  private writingControllers = new Map<string, AbortController>();
  private judgingControllers = new Map<string, AbortController>();

  async runWriting(taskId: string): Promise<void> {
    const store = useTaskStore.getState();
    const task = store.current;
    if (!task || task.id !== taskId) {
      throw new Error(`task ${taskId} not loaded`);
    }
    const settings = useSettingsStore.getState().settings;

    const ac = new AbortController();
    this.writingControllers.set(taskId, ac);
    store.setStatus(taskId, 'writing');

    await Promise.allSettled(
      task.candidates.map((c) => this.runOneCandidate(taskId, c.modelId, ac.signal, settings))
    );

    this.writingControllers.delete(taskId);
    useTaskStore.getState().setStatus(taskId, 'writing_done');
    await useTaskStore.getState().flushNow(taskId);
  }

  async retryCandidate(taskId: string, modelId: string): Promise<void> {
    const settings = useSettingsStore.getState().settings;
    const ac = new AbortController();
    // Reuse the same controller key; if a writing run is in progress, this
    // retry rides alongside it (rare, but harmless).
    this.writingControllers.set(taskId + ':' + modelId, ac);
    await this.runOneCandidate(taskId, modelId, ac.signal, settings);
    this.writingControllers.delete(taskId + ':' + modelId);
  }

  private async runOneCandidate(
    taskId: string,
    modelId: string,
    signal: AbortSignal,
    settings: ReturnType<typeof useSettingsStore.getState>['settings']
  ): Promise<void> {
    const store = useTaskStore.getState();
    const task = store.current;
    if (!task) return;
    store.setCandidateStreaming(taskId, modelId);

    try {
      const { fullText } = await streamWriting({
        modelId,
        systemPrompt: DEFAULT_WRITING_SYSTEM_PROMPT,
        userPrompt: task.writingPrompt,
        apiKey: settings.apiKey,
        baseUrl: settings.apiBaseUrl,
        signal,
        onChunk: (delta) => useTaskStore.getState().appendDelta(taskId, modelId, delta),
      });
      useTaskStore.getState().markCandidateDone(taskId, modelId, fullText);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      useTaskStore.getState().markCandidateError(taskId, modelId, msg);
    }
  }

  cancelWriting(taskId: string): void {
    this.writingControllers.get(taskId)?.abort();
  }

  async runJudging(taskId: string): Promise<void> {
    const store = useTaskStore.getState();
    const task = store.current;
    if (!task || task.id !== taskId) throw new Error(`task ${taskId} not loaded`);
    const settings = useSettingsStore.getState().settings;

    const ac = new AbortController();
    this.judgingControllers.set(taskId, ac);
    const startedAt = Date.now();
    store.startJudgeStream(taskId);

    const renderedPrompt = renderJudgePrompt(
      task.judgePrompt,
      task.writingPrompt,
      task.candidates
    );

    try {
      const { fullText } = await streamJudging({
        judgeModelId: task.judgeModel,
        judgePrompt: renderedPrompt,
        apiKey: settings.apiKey,
        baseUrl: settings.apiBaseUrl,
        signal: ac.signal,
        onChunk: (delta) => useTaskStore.getState().appendJudgeDelta(taskId, delta),
      });
      useTaskStore.getState().setJudgeResult(taskId, {
        rawMarkdown: fullText,
        renderedAt: startedAt,
        durationMs: Date.now() - startedAt,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      useTaskStore.getState().setJudgeResult(taskId, {
        rawMarkdown: useTaskStore.getState().current?.judgeResult?.rawMarkdown ?? '',
        renderedAt: startedAt,
        durationMs: Date.now() - startedAt,
        error: msg,
      });
    } finally {
      this.judgingControllers.delete(taskId);
    }
  }

  cancelJudging(taskId: string): void {
    this.judgingControllers.get(taskId)?.abort();
  }
}

/** Singleton: only one runner across the app. */
export const taskRunner = new TaskRunner();
```

- [ ] **Step 4: 跑测试看到绿**

Run: `pnpm test taskRunner`
Expected: PASS, 5 tests passed.

- [ ] **Step 5: Commit**

```bash
git add src/state/taskRunner.ts tests/unit/taskRunner.test.ts
git commit -m "feat(state): add TaskRunner with parallel writing and judging"
```

---

## Task 12: 基础 UI 组件（components/ui/）

最小集合，全部基于 Tailwind 类。这些组件后面所有页面都要用。

**Files:**
- Create: `src/components/ui/Button.tsx`
- Create: `src/components/ui/Card.tsx`
- Create: `src/components/ui/Textarea.tsx`
- Create: `src/components/ui/Checkbox.tsx`
- Create: `src/components/ui/Select.tsx`
- Create: `src/components/ui/Badge.tsx`
- Create: `src/components/ui/cn.ts`

- [ ] **Step 1: cn 工具**

Create `src/components/ui/cn.ts`:

```ts
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}
```

- [ ] **Step 2: Button**

Create `src/components/ui/Button.tsx`:

```tsx
import { forwardRef } from 'react';
import { cn } from './cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const variants: Record<Variant, string> = {
  primary: 'bg-brand text-white hover:bg-brand-dark disabled:bg-gray-300',
  secondary: 'bg-white border border-gray-300 text-gray-900 hover:bg-gray-50 disabled:text-gray-400',
  ghost: 'bg-transparent text-gray-700 hover:bg-gray-100 disabled:text-gray-400',
  danger: 'bg-red-600 text-white hover:bg-red-700 disabled:bg-red-300',
};

const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-sm',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-6 text-base',
};

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
};

export const Button = forwardRef<HTMLButtonElement, Props>(
  ({ variant = 'primary', size = 'md', className, ...rest }, ref) => (
    <button
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center rounded-md transition-colors disabled:cursor-not-allowed',
        variants[variant],
        sizes[size],
        className
      )}
      {...rest}
    />
  )
);
Button.displayName = 'Button';
```

- [ ] **Step 3: Card**

Create `src/components/ui/Card.tsx`:

```tsx
import { cn } from './cn';

export function Card({ className, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded border border-gray-200 bg-white', className)} {...rest} />;
}

export function CardHeader({ className, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-4 py-3 border-b border-gray-200', className)} {...rest} />;
}

export function CardBody({ className, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-4 py-3', className)} {...rest} />;
}
```

- [ ] **Step 4: Textarea**

Create `src/components/ui/Textarea.tsx`:

```tsx
import { forwardRef } from 'react';
import { cn } from './cn';

type Props = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = forwardRef<HTMLTextAreaElement, Props>(({ className, ...rest }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      'w-full rounded border border-gray-300 px-3 py-2 text-sm font-mono leading-6',
      'focus:outline-none focus:ring-2 focus:ring-brand/40',
      className
    )}
    {...rest}
  />
));
Textarea.displayName = 'Textarea';
```

- [ ] **Step 5: Checkbox**

Create `src/components/ui/Checkbox.tsx`:

```tsx
import { cn } from './cn';

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  label: React.ReactNode;
};

export function Checkbox({ label, className, ...rest }: Props) {
  return (
    <label className={cn('inline-flex items-center gap-2 cursor-pointer select-none', className)}>
      <input type="checkbox" className="h-4 w-4 accent-brand" {...rest} />
      <span className="text-sm">{label}</span>
    </label>
  );
}
```

- [ ] **Step 6: Select**

Create `src/components/ui/Select.tsx`:

```tsx
import { forwardRef } from 'react';
import { cn } from './cn';

type Props = React.SelectHTMLAttributes<HTMLSelectElement>;

export const Select = forwardRef<HTMLSelectElement, Props>(({ className, children, ...rest }, ref) => (
  <select
    ref={ref}
    className={cn(
      'h-10 rounded border border-gray-300 bg-white px-3 text-sm',
      'focus:outline-none focus:ring-2 focus:ring-brand/40',
      className
    )}
    {...rest}
  >
    {children}
  </select>
));
Select.displayName = 'Select';
```

- [ ] **Step 7: Badge**

Create `src/components/ui/Badge.tsx`:

```tsx
import { cn } from './cn';

type Tone = 'gray' | 'blue' | 'green' | 'red' | 'brand';

const tones: Record<Tone, string> = {
  gray: 'bg-gray-100 text-gray-700',
  blue: 'bg-blue-100 text-blue-700',
  green: 'bg-green-100 text-green-700',
  red: 'bg-red-100 text-red-700',
  brand: 'bg-brand/10 text-brand',
};

export function Badge({
  tone = 'gray',
  pulse,
  children,
}: {
  tone?: Tone;
  pulse?: boolean;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
        tones[tone],
        pulse && 'animate-pulse'
      )}
    >
      {children}
    </span>
  );
}
```

- [ ] **Step 8: 类型 check 通过**

Run: `pnpm exec tsc -b --noEmit`
Expected: 无错误。

- [ ] **Step 9: Commit**

```bash
git add src/components/ui
git commit -m "feat(ui): add base components (Button, Card, Textarea, Checkbox, Select, Badge)"
```

---

## Task 13: 业务组件（StatusBadge / ModelCheckboxGrid / PromptEditor）

**Files:**
- Create: `src/components/StatusBadge.tsx`
- Create: `src/components/ModelCheckboxGrid.tsx`
- Create: `src/components/PromptEditor.tsx`

- [ ] **Step 1: StatusBadge**

Create `src/components/StatusBadge.tsx`:

```tsx
import { Badge } from './ui/Badge';
import type { CandidateStatus, TaskStatus } from '@/types/task';

type Props = { status: CandidateStatus | TaskStatus };

const map: Record<string, { tone: 'gray' | 'blue' | 'green' | 'red' | 'brand'; label: string; pulse?: boolean }> = {
  // candidate
  pending: { tone: 'gray', label: '等待' },
  streaming: { tone: 'blue', label: '写作中', pulse: true },
  done: { tone: 'green', label: '完成' },
  error: { tone: 'red', label: '错误' },
  // task
  idle: { tone: 'gray', label: '初始化' },
  writing: { tone: 'blue', label: '写作中', pulse: true },
  writing_done: { tone: 'brand', label: '待评测' },
  judging: { tone: 'blue', label: '评测中', pulse: true },
};

export function StatusBadge({ status }: Props) {
  const m = map[status] ?? { tone: 'gray' as const, label: status };
  return (
    <Badge tone={m.tone} pulse={m.pulse}>
      {m.label}
    </Badge>
  );
}
```

- [ ] **Step 2: ModelCheckboxGrid**

Create `src/components/ModelCheckboxGrid.tsx`:

```tsx
import { Checkbox } from './ui/Checkbox';
import { Button } from './ui/Button';
import { MODELS } from '@/constants/models';

type Props = {
  selected: string[];
  onChange: (next: string[]) => void;
};

export function ModelCheckboxGrid({ selected, onChange }: Props) {
  const toggle = (id: string, on: boolean) => {
    onChange(on ? Array.from(new Set([...selected, id])) : selected.filter((s) => s !== id));
  };
  const allIds = MODELS.map((m) => m.id);
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm text-gray-600">
          已勾选 {selected.length} / {MODELS.length}
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => onChange(allIds)}>
            全选
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onChange([])}>
            全不选
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {MODELS.map((m) => (
          <Checkbox
            key={m.id}
            label={m.label}
            checked={selected.includes(m.id)}
            onChange={(e) => toggle(m.id, e.target.checked)}
          />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: PromptEditor**

Create `src/components/PromptEditor.tsx`:

```tsx
import { Textarea } from './ui/Textarea';
import { Button } from './ui/Button';

type Props = {
  label?: string;
  value: string;
  onChange: (next: string) => void;
  rows?: number;
  placeholder?: string;
  onResetDefault?: () => void;
};

export function PromptEditor({ label, value, onChange, rows = 6, placeholder, onResetDefault }: Props) {
  return (
    <div>
      {label && (
        <div className="mb-1 flex items-center justify-between">
          <label className="text-sm font-medium text-gray-800">{label}</label>
          {onResetDefault && (
            <Button size="sm" variant="ghost" onClick={onResetDefault}>
              恢复默认
            </Button>
          )}
        </div>
      )}
      <Textarea rows={rows} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/StatusBadge.tsx src/components/ModelCheckboxGrid.tsx src/components/PromptEditor.tsx
git commit -m "feat(components): add status badge, model grid, prompt editor"
```

---

## Task 14: Markdown 渲染（lib/markdown.ts）+ ReportPanel

**Files:**
- Create: `src/lib/markdown.ts`
- Create: `src/components/ReportPanel.tsx`

- [ ] **Step 1: markdown.ts**

Create `src/lib/markdown.ts`:

```ts
import { marked } from 'marked';
import DOMPurify from 'dompurify';

marked.setOptions({ gfm: true, breaks: true });

export function renderMarkdown(md: string): string {
  const raw = marked.parse(md ?? '', { async: false }) as string;
  return DOMPurify.sanitize(raw);
}
```

- [ ] **Step 2: ReportPanel**

Create `src/components/ReportPanel.tsx`:

```tsx
import { useMemo } from 'react';
import { Card, CardHeader, CardBody } from './ui/Card';
import { Button } from './ui/Button';
import { renderMarkdown } from '@/lib/markdown';
import { applyAliasReplacement } from '@/services/aliasMap';
import { MODEL_BY_ID } from '@/constants/models';
import type { Task } from '@/types/task';
import { formatDuration } from '@/lib/format';

type Props = {
  task: Task;
  onRetry?: () => void;
};

export function ReportPanel({ task, onRetry }: Props) {
  const aliasToLabel = useMemo(() => {
    const map: Record<string, string> = {};
    for (const c of task.candidates) {
      map[c.alias] = MODEL_BY_ID[c.modelId]?.label ?? c.modelId;
    }
    return map;
  }, [task.candidates]);

  const md = task.judgeResult?.rawMarkdown ?? '';
  const replaced = task.anonymize ? applyAliasReplacement(md, aliasToLabel) : md;
  const html = useMemo(() => renderMarkdown(replaced), [replaced]);

  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-semibold">📊 评测报告</span>
          {task.judgeResult?.durationMs ? (
            <span className="text-xs text-gray-500">耗时 {formatDuration(task.judgeResult.durationMs)}</span>
          ) : null}
        </div>
        {onRetry && (
          <Button size="sm" variant="secondary" onClick={onRetry}>
            ⟳ 重新评测
          </Button>
        )}
      </CardHeader>
      <CardBody>
        {task.judgeResult?.error && (
          <div className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {task.judgeResult.error}
          </div>
        )}
        {!md ? (
          <div className="text-sm text-gray-500">报告尚未生成。</div>
        ) : (
          <div
            className="prose prose-sm max-w-none prose-table:text-sm"
            // eslint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{ __html: html }}
          />
        )}
      </CardBody>
    </Card>
  );
}
```

- [ ] **Step 3: 加 prose 插件（可选，简单方案：手写样式）**

为避免引 typography 插件，给 `src/index.css` 追加最小 prose 样式：

```css
.prose h1 { @apply text-xl font-bold mt-4 mb-2; }
.prose h2 { @apply text-lg font-semibold mt-3 mb-2; }
.prose h3 { @apply text-base font-semibold mt-2 mb-1; }
.prose p  { @apply my-2 leading-7; }
.prose ul { @apply list-disc pl-6 my-2; }
.prose ol { @apply list-decimal pl-6 my-2; }
.prose table { @apply w-full border-collapse my-3; }
.prose th, .prose td { @apply border border-gray-300 px-2 py-1 text-left; }
.prose th { @apply bg-gray-50; }
.prose code { @apply bg-gray-100 px-1 rounded; }
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/markdown.ts src/components/ReportPanel.tsx src/index.css
git commit -m "feat(ui): add markdown renderer and report panel with alias mapping"
```

---

## Task 15: CandidateCard + 三种视图 + ViewSwitcher

**Files:**
- Create: `src/components/CandidateCard.tsx`
- Create: `src/components/CandidateGrid.tsx`
- Create: `src/components/CandidateSplitView.tsx`
- Create: `src/components/CandidateTabView.tsx`
- Create: `src/components/ViewSwitcher.tsx`

- [ ] **Step 1: CandidateCard**

Create `src/components/CandidateCard.tsx`:

```tsx
import { useState } from 'react';
import { Card, CardHeader, CardBody } from './ui/Card';
import { StatusBadge } from './StatusBadge';
import { Button } from './ui/Button';
import { MODEL_BY_ID } from '@/constants/models';
import type { Candidate } from '@/types/task';
import { countChars, formatDuration } from '@/lib/format';

type Props = {
  candidate: Candidate;
  onRetry?: () => void;
  /** 'preview' = 卡片网格里只显示前几行；'full' = Tab/Split 视图全文 */
  mode?: 'preview' | 'full';
};

export function CandidateCard({ candidate: c, onRetry, mode = 'preview' }: Props) {
  const [expanded, setExpanded] = useState(false);
  const showFull = mode === 'full' || expanded;
  const label = MODEL_BY_ID[c.modelId]?.label ?? c.modelId;
  const elapsed =
    c.startedAt && c.finishedAt ? formatDuration(c.finishedAt - c.startedAt) : null;

  return (
    <Card className="flex flex-col h-full">
      <CardHeader className="flex items-center justify-between">
        <div className="flex flex-col">
          <span className="text-sm font-semibold">{label}</span>
          <span className="text-xs text-gray-500">
            {c.alias}
            {elapsed ? ` · ⏱ ${elapsed}` : null}
          </span>
        </div>
        <StatusBadge status={c.status} />
      </CardHeader>
      <CardBody className="flex-1">
        {c.status === 'error' ? (
          <div className="space-y-2">
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1">
              {c.errorMessage ?? '生成失败'}
            </div>
            {onRetry && (
              <Button size="sm" variant="secondary" onClick={onRetry}>
                重试此模型
              </Button>
            )}
          </div>
        ) : (
          <>
            <pre className={`whitespace-pre-wrap text-sm leading-6 ${showFull ? '' : 'line-clamp-6'}`}>
              {c.article || (c.status === 'streaming' ? '...' : '（暂无内容）')}
            </pre>
            {mode === 'preview' && c.article.length > 0 && (
              <button
                className="mt-2 text-xs text-brand hover:underline"
                onClick={() => setExpanded((v) => !v)}
              >
                {expanded ? '收起' : '展开全文 ▾'}
              </button>
            )}
            {c.status === 'done' && (
              <div className="mt-2 text-xs text-gray-500">{countChars(c.article)} 字</div>
            )}
          </>
        )}
      </CardBody>
    </Card>
  );
}
```

由于上面用了 `line-clamp-6`，需要在 tailwind 里启用：tailwindcss 3.3+ 已内置，无需插件。如果环境不支持，给 index.css 追加：

```css
.line-clamp-6 {
  display: -webkit-box;
  -webkit-line-clamp: 6;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
```

- [ ] **Step 2: CandidateGrid**

Create `src/components/CandidateGrid.tsx`:

```tsx
import type { Candidate } from '@/types/task';
import { CandidateCard } from './CandidateCard';

type Props = {
  candidates: Candidate[];
  onRetry?: (modelId: string) => void;
};

export function CandidateGrid({ candidates, onRetry }: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      {candidates.map((c) => (
        <CandidateCard
          key={c.modelId}
          candidate={c}
          mode="preview"
          onRetry={onRetry ? () => onRetry(c.modelId) : undefined}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 3: CandidateSplitView**

Create `src/components/CandidateSplitView.tsx`:

```tsx
import type { Candidate } from '@/types/task';
import { CandidateCard } from './CandidateCard';

type Props = { candidates: Candidate[]; onRetry?: (modelId: string) => void };

export function CandidateSplitView({ candidates, onRetry }: Props) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {candidates.map((c) => (
        <div key={c.modelId} className="min-w-[360px] max-w-[480px] flex-1">
          <CandidateCard
            candidate={c}
            mode="full"
            onRetry={onRetry ? () => onRetry(c.modelId) : undefined}
          />
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: CandidateTabView**

Create `src/components/CandidateTabView.tsx`:

```tsx
import { useState } from 'react';
import type { Candidate } from '@/types/task';
import { CandidateCard } from './CandidateCard';
import { MODEL_BY_ID } from '@/constants/models';
import { cn } from './ui/cn';

type Props = { candidates: Candidate[]; onRetry?: (modelId: string) => void };

export function CandidateTabView({ candidates, onRetry }: Props) {
  const [active, setActive] = useState<string>(candidates[0]?.modelId ?? '');
  const cur = candidates.find((c) => c.modelId === active) ?? candidates[0];
  return (
    <div>
      <div className="flex flex-wrap gap-1 mb-2 border-b border-gray-200">
        {candidates.map((c) => {
          const label = MODEL_BY_ID[c.modelId]?.label ?? c.modelId;
          return (
            <button
              key={c.modelId}
              onClick={() => setActive(c.modelId)}
              className={cn(
                'px-3 py-1.5 text-sm border-b-2 -mb-px',
                active === c.modelId
                  ? 'border-brand text-brand'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              )}
            >
              {label}
            </button>
          );
        })}
      </div>
      {cur && (
        <CandidateCard
          candidate={cur}
          mode="full"
          onRetry={onRetry ? () => onRetry(cur.modelId) : undefined}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 5: ViewSwitcher**

Create `src/components/ViewSwitcher.tsx`:

```tsx
import { cn } from './ui/cn';

export type ViewMode = 'grid' | 'split' | 'tab';

const labels: Record<ViewMode, string> = {
  grid: '卡片网格',
  split: '并排对比',
  tab: 'Tab',
};

export function ViewSwitcher({ value, onChange }: { value: ViewMode; onChange: (v: ViewMode) => void }) {
  return (
    <div className="inline-flex rounded border border-gray-300 overflow-hidden">
      {(Object.keys(labels) as ViewMode[]).map((m) => (
        <button
          key={m}
          onClick={() => onChange(m)}
          className={cn(
            'px-3 py-1.5 text-sm',
            value === m ? 'bg-brand text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
          )}
        >
          {labels[m]}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add src/components/Candidate*.tsx src/components/ViewSwitcher.tsx src/index.css
git commit -m "feat(ui): add candidate cards and three view modes"
```

---

## Task 16: 路由与 App 骨架

**Files:**
- Modify: `src/App.tsx`
- Create: `src/components/AppShell.tsx`

- [ ] **Step 1: AppShell（顶部 nav）**

Create `src/components/AppShell.tsx`:

```tsx
import { Link, NavLink, Outlet } from 'react-router-dom';
import { cn } from './ui/cn';

const linkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'px-3 py-1.5 text-sm rounded',
    isActive ? 'bg-brand text-white' : 'text-gray-700 hover:bg-gray-100'
  );

export function AppShell() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-gray-200">
        <div className="mx-auto max-w-6xl flex items-center justify-between px-4 h-14">
          <Link to="/" className="font-semibold text-gray-900">
            ✍ 写作模型评测
          </Link>
          <nav className="flex gap-1">
            <NavLink to="/new" className={linkClass}>新建</NavLink>
            <NavLink to="/history" className={linkClass}>历史</NavLink>
            <NavLink to="/settings" className={linkClass}>设置</NavLink>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl w-full flex-1 px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
```

- [ ] **Step 2: App.tsx**

Replace `src/App.tsx`:

```tsx
import { Routes, Route, Navigate } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { HomePage } from './pages/HomePage';
import { NewTaskPage } from './pages/NewTaskPage';
import { TaskDetailPage } from './pages/TaskDetailPage';
import { HistoryPage } from './pages/HistoryPage';
import { SettingsPage } from './pages/SettingsPage';

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<HomePage />} />
        <Route path="new" element={<NewTaskPage />} />
        <Route path="task/:id" element={<TaskDetailPage />} />
        <Route path="history" element={<HistoryPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
```

注意：此时 5 个 page 文件还不存在，下一步 Task 17 才创建 — 编译器会报缺失。这是 OK 的，按 plan 顺序继续。

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx src/components/AppShell.tsx
git commit -m "feat(app): add router shell and route layout"
```

---

## Task 17: HomePage / SettingsPage

简单页面先做掉。

**Files:**
- Create: `src/pages/HomePage.tsx`
- Create: `src/pages/SettingsPage.tsx`

- [ ] **Step 1: HomePage**

Create `src/pages/HomePage.tsx`:

```tsx
import { Link } from 'react-router-dom';
import { useSettingsStore } from '@/state/settingsStore';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

export function HomePage() {
  const { apiKey } = useSettingsStore((s) => s.settings);
  const hasKey = Boolean(apiKey);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">写作模型评测工具</h1>
      <p className="text-gray-600">
        让多个 AI 模型针对同一道题目作答，再用一个评测者模型横向打分、给出报告。
      </p>

      {!hasKey && (
        <Card className="bg-amber-50 border-amber-200">
          <CardBody className="flex items-center justify-between gap-4">
            <span className="text-sm text-amber-800">
              尚未配置 API Key，先去设置页面填一下吧。
            </span>
            <Link to="/settings">
              <Button variant="primary" size="sm">去设置</Button>
            </Link>
          </CardBody>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Link to="/new"><Card className="hover:bg-gray-50"><CardBody>
          <div className="text-2xl">📝</div>
          <div className="font-semibold mt-1">新建测试任务</div>
          <div className="text-sm text-gray-600 mt-1">填写作题目、勾选模型、开始测试。</div>
        </CardBody></Card></Link>
        <Link to="/history"><Card className="hover:bg-gray-50"><CardBody>
          <div className="text-2xl">📚</div>
          <div className="font-semibold mt-1">历史任务</div>
          <div className="text-sm text-gray-600 mt-1">查看以前的评测结果。</div>
        </CardBody></Card></Link>
        <Link to="/settings"><Card className="hover:bg-gray-50"><CardBody>
          <div className="text-2xl">⚙️</div>
          <div className="font-semibold mt-1">设置</div>
          <div className="text-sm text-gray-600 mt-1">API Key、默认 Prompt、默认模型。</div>
        </CardBody></Card></Link>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: SettingsPage**

Create `src/pages/SettingsPage.tsx`:

```tsx
import { useState } from 'react';
import { useSettingsStore } from '@/state/settingsStore';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Checkbox } from '@/components/ui/Checkbox';
import { PromptEditor } from '@/components/PromptEditor';
import { MODELS } from '@/constants/models';
import { DEFAULT_JUDGE_PROMPT } from '@/constants/defaultPrompts';
import { maskApiKey } from '@/lib/format';

export function SettingsPage() {
  const settings = useSettingsStore((s) => s.settings);
  const update = useSettingsStore((s) => s.update);
  const [reveal, setReveal] = useState(false);
  const [draft, setDraft] = useState(settings);

  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-xl font-bold">设置</h1>

      <section>
        <label className="text-sm font-medium">API Key</label>
        <div className="flex gap-2 mt-1">
          <input
            type={reveal ? 'text' : 'password'}
            className="flex-1 h-10 rounded border border-gray-300 px-3 text-sm font-mono"
            value={reveal ? draft.apiKey : maskApiKey(draft.apiKey)}
            onChange={(e) => setDraft({ ...draft, apiKey: e.target.value })}
            placeholder="bsk-xxxxxxxxxxxxxxxxxxxxxxxx"
          />
          <Button variant="secondary" onClick={() => setReveal((v) => !v)}>
            {reveal ? '隐藏' : '显示'}
          </Button>
          <Button variant="ghost" onClick={() => setDraft({ ...draft, apiKey: '' })}>清除</Button>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          留空则使用环境变量 VITE_LLM_API_KEY。本字段会保存到浏览器 localStorage。
        </p>
      </section>

      <section>
        <label className="text-sm font-medium">API Base URL</label>
        <input
          className="w-full h-10 rounded border border-gray-300 px-3 text-sm font-mono mt-1"
          value={draft.apiBaseUrl}
          onChange={(e) => setDraft({ ...draft, apiBaseUrl: e.target.value })}
        />
      </section>

      <section>
        <PromptEditor
          label="默认评测 Prompt"
          value={draft.defaultJudgePrompt}
          onChange={(v) => setDraft({ ...draft, defaultJudgePrompt: v })}
          rows={12}
          onResetDefault={() => setDraft({ ...draft, defaultJudgePrompt: DEFAULT_JUDGE_PROMPT })}
        />
      </section>

      <section>
        <label className="text-sm font-medium">默认评测者模型</label>
        <Select
          className="mt-1"
          value={draft.defaultJudgeModel}
          onChange={(e) => setDraft({ ...draft, defaultJudgeModel: e.target.value })}
        >
          {MODELS.map((m) => (
            <option key={m.id} value={m.id}>{m.label}</option>
          ))}
        </Select>
      </section>

      <section>
        <Checkbox
          label="默认开启匿名评测"
          checked={draft.defaultAnonymize}
          onChange={(e) => setDraft({ ...draft, defaultAnonymize: e.target.checked })}
        />
      </section>

      <div className="flex gap-2">
        <Button onClick={() => update(draft)}>保存</Button>
        <Button variant="ghost" onClick={() => setDraft(settings)}>重置</Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: 跑 dev server 看一眼这两页**

Run: `pnpm dev`
Expected: 浏览器访问 / 和 /settings 能正常渲染（其他路由会因为 Task 18+ 还没建报错）。

- [ ] **Step 4: Commit**

```bash
git add src/pages/HomePage.tsx src/pages/SettingsPage.tsx
git commit -m "feat(pages): add home and settings pages"
```

---

## Task 18: NewTaskPage

**Files:**
- Create: `src/pages/NewTaskPage.tsx`

- [ ] **Step 1: 实现 NewTaskPage**

Create `src/pages/NewTaskPage.tsx`:

```tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSettingsStore } from '@/state/settingsStore';
import { useTaskStore } from '@/state/taskStore';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Checkbox } from '@/components/ui/Checkbox';
import { PromptEditor } from '@/components/PromptEditor';
import { ModelCheckboxGrid } from '@/components/ModelCheckboxGrid';
import { MODELS, DEFAULT_JUDGE_MODEL } from '@/constants/models';
import { DEFAULT_JUDGE_PROMPT } from '@/constants/defaultPrompts';
import { assignAliases } from '@/services/aliasMap';
import { uuid } from '@/lib/id';
import type { Task, Candidate } from '@/types/task';

export function NewTaskPage() {
  const navigate = useNavigate();
  const settings = useSettingsStore((s) => s.settings);
  const updateSettings = useSettingsStore((s) => s.update);
  const saveNew = useTaskStore((s) => s.saveNew);

  const [writingPrompt, setWritingPrompt] = useState(settings.defaultWritingPrompt);
  const [selected, setSelected] = useState<string[]>(settings.defaultSelectedModels);
  const [judgeModel, setJudgeModel] = useState(settings.defaultJudgeModel || DEFAULT_JUDGE_MODEL);
  const [anonymize, setAnonymize] = useState(settings.defaultAnonymize);
  const [judgePrompt, setJudgePrompt] = useState(settings.defaultJudgePrompt);
  const [showJudgePrompt, setShowJudgePrompt] = useState(false);

  const canStart =
    writingPrompt.trim().length > 0 &&
    selected.length > 0 &&
    Boolean(settings.apiKey);

  async function start() {
    const aliases = assignAliases(selected);
    const candidates: Candidate[] = selected.map((id) => ({
      modelId: id,
      alias: aliases[id],
      status: 'pending',
      article: '',
    }));

    const task: Task = {
      id: uuid(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      title: writingPrompt.slice(0, 30),
      status: 'idle',
      writingPrompt,
      judgePrompt,
      judgeModel,
      anonymize,
      candidates,
    };

    // 保存当前选择为下次默认
    updateSettings({
      defaultWritingPrompt: writingPrompt,
      defaultSelectedModels: selected,
      defaultJudgeModel: judgeModel,
      defaultAnonymize: anonymize,
      defaultJudgePrompt: judgePrompt,
    });

    await saveNew(task);
    navigate(`/task/${task.id}?autostart=1`);
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-xl font-bold">新建写作测试任务</h1>

      <PromptEditor
        label="写作 Prompt（每个测试者拿到的题目）"
        value={writingPrompt}
        onChange={setWritingPrompt}
        rows={6}
      />

      <section>
        <div className="text-sm font-medium mb-2">选择测试者模型</div>
        <ModelCheckboxGrid selected={selected} onChange={setSelected} />
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">评测者模型</label>
          <Select
            className="mt-1 w-full"
            value={judgeModel}
            onChange={(e) => setJudgeModel(e.target.value)}
          >
            {MODELS.map((m) => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </Select>
        </div>
        <div className="flex items-end">
          <Checkbox
            label="匿名评测（评测者看不到模型真名）"
            checked={anonymize}
            onChange={(e) => setAnonymize(e.target.checked)}
          />
        </div>
      </section>

      <section>
        <button
          className="text-sm text-brand hover:underline"
          onClick={() => setShowJudgePrompt((v) => !v)}
        >
          {showJudgePrompt ? '▾' : '▸'} 评测 Prompt（可自定义）
        </button>
        {showJudgePrompt && (
          <div className="mt-2">
            <PromptEditor
              value={judgePrompt}
              onChange={setJudgePrompt}
              rows={12}
              onResetDefault={() => setJudgePrompt(DEFAULT_JUDGE_PROMPT)}
            />
            <p className="text-xs text-gray-500 mt-1">
              使用 {'{{writing_prompt}}'} 和 {'{{articles}}'} 作为占位符。
            </p>
          </div>
        )}
      </section>

      <div className="flex justify-end">
        <Button size="lg" disabled={!canStart} onClick={start}>
          开始测试
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/NewTaskPage.tsx
git commit -m "feat(pages): add new task page"
```

---

## Task 19: TaskDetailPage（写作 + 评测主战场）

**Files:**
- Create: `src/pages/TaskDetailPage.tsx`

- [ ] **Step 1: 实现 TaskDetailPage**

Create `src/pages/TaskDetailPage.tsx`:

```tsx
import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { useTaskStore } from '@/state/taskStore';
import { taskRunner } from '@/state/taskRunner';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { ViewSwitcher, type ViewMode } from '@/components/ViewSwitcher';
import { CandidateGrid } from '@/components/CandidateGrid';
import { CandidateSplitView } from '@/components/CandidateSplitView';
import { CandidateTabView } from '@/components/CandidateTabView';
import { ReportPanel } from '@/components/ReportPanel';
import { StatusBadge } from '@/components/StatusBadge';
import { formatTime } from '@/lib/format';

export function TaskDetailPage() {
  const { id = '' } = useParams();
  const [params] = useSearchParams();
  const task = useTaskStore((s) => s.current);
  const loadTask = useTaskStore((s) => s.loadTask);

  const [view, setView] = useState<ViewMode>('grid');

  useEffect(() => {
    let alive = true;
    (async () => {
      const t = await loadTask(id);
      if (alive && t && params.get('autostart') === '1' && t.status === 'idle') {
        await taskRunner.runWriting(id);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const doneCount = useMemo(
    () => task?.candidates.filter((c) => c.status === 'done').length ?? 0,
    [task]
  );
  const total = task?.candidates.length ?? 0;

  if (!task) {
    return <div className="text-gray-500">加载中...</div>;
  }

  const canJudge = task.status === 'writing_done' || task.status === 'done';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link to="/history" className="text-sm text-gray-500 hover:text-gray-700">← 历史</Link>
          <StatusBadge status={task.status} />
          <span className="text-xs text-gray-500">创建于 {formatTime(task.createdAt)}</span>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => exportTask(task)}
          >
            ⤓ 导出 JSON
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="flex items-center justify-between">
          <span className="font-semibold">📝 写作题目</span>
        </CardHeader>
        <CardBody>
          <pre className="whitespace-pre-wrap text-sm">{task.writingPrompt}</pre>
        </CardBody>
      </Card>

      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-700">
          {task.status === 'writing' && <>正在写作 {doneCount}/{total} 已完成</>}
          {task.status === 'writing_done' && <>✅ 全部完成 ({doneCount}/{total})，请点击自动评测</>}
          {task.status === 'done' && <>评测已完成</>}
        </div>
        <div className="flex items-center gap-2">
          <ViewSwitcher value={view} onChange={setView} />
          {task.status === 'writing' && (
            <Button size="sm" variant="danger" onClick={() => taskRunner.cancelWriting(id)}>
              取消
            </Button>
          )}
          {canJudge && (
            <Button
              size="sm"
              onClick={() => taskRunner.runJudging(id)}
              disabled={task.status === 'judging'}
            >
              {task.status === 'done' ? '⟳ 重新评测' : '🎯 自动评测'}
            </Button>
          )}
        </div>
      </div>

      {view === 'grid' && (
        <CandidateGrid
          candidates={task.candidates}
          onRetry={(modelId) => taskRunner.retryCandidate(id, modelId)}
        />
      )}
      {view === 'split' && (
        <CandidateSplitView
          candidates={task.candidates}
          onRetry={(modelId) => taskRunner.retryCandidate(id, modelId)}
        />
      )}
      {view === 'tab' && (
        <CandidateTabView
          candidates={task.candidates}
          onRetry={(modelId) => taskRunner.retryCandidate(id, modelId)}
        />
      )}

      {(task.judgeResult || task.status === 'judging') && (
        <ReportPanel task={task} />
      )}
    </div>
  );
}

function exportTask(task: { id: string }) {
  const data = JSON.stringify(task, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `task-${task.id}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/TaskDetailPage.tsx
git commit -m "feat(pages): add task detail page"
```

---

## Task 20: HistoryPage

**Files:**
- Create: `src/pages/HistoryPage.tsx`
- Create: `src/components/TaskListItem.tsx`

- [ ] **Step 1: TaskListItem**

Create `src/components/TaskListItem.tsx`:

```tsx
import { Link } from 'react-router-dom';
import { Card, CardBody } from './ui/Card';
import { Button } from './ui/Button';
import { StatusBadge } from './StatusBadge';
import { MODEL_BY_ID } from '@/constants/models';
import { formatTime } from '@/lib/format';
import type { Task } from '@/types/task';

export function TaskListItem({ task, onDelete }: { task: Task; onDelete: () => void }) {
  const winner = extractWinnerModelId(task);
  const winnerLabel = winner ? MODEL_BY_ID[winner]?.label ?? winner : null;

  return (
    <Card className="hover:bg-gray-50">
      <CardBody className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <StatusBadge status={task.status} />
            <span className="font-medium truncate">{task.title || '(无标题)'}</span>
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {task.candidates.length} 个模型 · {formatTime(task.createdAt)}
            {winnerLabel ? ` · 冠军：${winnerLabel}` : ''}
          </div>
        </div>
        <div className="flex gap-2">
          <Link to={`/task/${task.id}`}>
            <Button size="sm">打开</Button>
          </Link>
          <Button size="sm" variant="ghost" onClick={onDelete}>删除</Button>
        </div>
      </CardBody>
    </Card>
  );
}

function extractWinnerModelId(task: Task): string | null {
  // 简单启发：在 markdown 中找形如 "冠军：模型 X" 的字样，再映射到 modelId。
  // 找不到就返回 null。
  if (!task.judgeResult?.rawMarkdown) return null;
  const md = task.judgeResult.rawMarkdown;
  const m = md.match(/冠军[：:]\s*(模型\s*[A-Z]+)/);
  if (!m) return null;
  const alias = m[1].replace(/\s+/g, ' ');
  const cand = task.candidates.find((c) => c.alias === alias);
  return cand?.modelId ?? null;
}
```

- [ ] **Step 2: HistoryPage**

Create `src/pages/HistoryPage.tsx`:

```tsx
import { useEffect, useRef } from 'react';
import { useTaskStore } from '@/state/taskStore';
import { Button } from '@/components/ui/Button';
import { TaskListItem } from '@/components/TaskListItem';
import { TaskRepo } from '@/db/taskRepo';
import { db } from '@/db/schema';
import type { Task } from '@/types/task';

const repo = new TaskRepo(db);

export function HistoryPage() {
  const list = useTaskStore((s) => s.list);
  const loadList = useTaskStore((s) => s.loadList);
  const deleteTask = useTaskStore((s) => s.deleteTask);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  async function exportAll() {
    const all = await repo.exportAll();
    const blob = new Blob([JSON.stringify(all, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tasks-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function importFromFile(file: File) {
    const text = await file.text();
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      alert('JSON 解析失败');
      return;
    }
    const tasks: Task[] = Array.isArray(data) ? (data as Task[]) : [data as Task];
    await repo.importAll(tasks);
    await loadList();
    alert(`已导入 ${tasks.length} 个任务`);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">历史任务（{list.length}）</h1>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => fileRef.current?.click()}>⤒ 导入</Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void importFromFile(f);
              e.target.value = '';
            }}
          />
          <Button variant="secondary" onClick={exportAll}>⤓ 全部导出</Button>
        </div>
      </div>

      {list.length === 0 ? (
        <div className="text-gray-500 text-sm">暂无任务。</div>
      ) : (
        <div className="space-y-2">
          {list.map((t) => (
            <TaskListItem
              key={t.id}
              task={t}
              onDelete={async () => {
                if (confirm(`删除任务「${t.title}」？`)) await deleteTask(t.id);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: 类型 check**

Run: `pnpm exec tsc -b --noEmit`
Expected: 无错误。

- [ ] **Step 4: Commit**

```bash
git add src/pages/HistoryPage.tsx src/components/TaskListItem.tsx
git commit -m "feat(pages): add history page with import/export"
```

---

## Task 21: 集成测试（TaskDetailPage 完整流程）

用 MSW mock LLM Gateway 的流式响应，跑通"勾 3 个模型 → 自动评测"完整流程。

**Files:**
- Create: `tests/fixtures/sse-responses.ts`
- Create: `tests/integration/TaskDetailPage.test.tsx`

- [ ] **Step 1: SSE fixture 工具**

Create `tests/fixtures/sse-responses.ts`:

```ts
/** Build a Server-Sent Events response body that streams the given chunks. */
export function buildSSEBody(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        const json = JSON.stringify({ choices: [{ delta: { content: chunk } }] });
        controller.enqueue(encoder.encode(`data: ${json}\n\n`));
      }
      controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      controller.close();
    },
  });
}

export function buildSSEResponse(chunks: string[]): Response {
  return new Response(buildSSEBody(chunks), {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream' },
  });
}
```

- [ ] **Step 2: 集成测试**

Create `tests/integration/TaskDetailPage.test.tsx`:

```tsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { TaskDetailPage } from '@/pages/TaskDetailPage';
import { useTaskStore } from '@/state/taskStore';
import { useSettingsStore } from '@/state/settingsStore';
import { uuid } from '@/lib/id';
import type { Task } from '@/types/task';
import { buildSSEResponse } from '../fixtures/sse-responses';

// Mock fetch globally with model-aware responses.
const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

function freshTask(modelIds: string[]): Task {
  return {
    id: uuid(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    title: '测试',
    status: 'idle',
    writingPrompt: '题目',
    judgePrompt: '题目：{{writing_prompt}}\n\n{{articles}}',
    judgeModel: 'judge-model',
    anonymize: true,
    candidates: modelIds.map((id, i) => ({
      modelId: id,
      alias: `模型 ${String.fromCharCode(65 + i)}`,
      status: 'pending' as const,
      article: '',
    })),
  };
}

function setupSettings() {
  useSettingsStore.setState({
    settings: {
      apiKey: 'test-key',
      apiBaseUrl: '/api/v1',
      defaultWritingPrompt: '',
      defaultJudgePrompt: '',
      defaultSelectedModels: [],
      defaultJudgeModel: 'judge-model',
      defaultAnonymize: true,
    },
  } as any);
}

describe('TaskDetailPage integration', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    useTaskStore.setState({ current: null, list: [] });
    setupSettings();
  });

  it('runs writing + judging end-to-end with autostart', async () => {
    fetchMock.mockImplementation(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string);
      if (body.model === 'judge-model') {
        return buildSSEResponse(['# 报告\n', '冠军：', '模型 A']);
      }
      return buildSSEResponse([`文章-${body.model}`]);
    });

    const task = freshTask(['m1', 'm2']);
    await useTaskStore.getState().saveNew(task);

    render(
      <MemoryRouter initialEntries={[`/task/${task.id}?autostart=1`]}>
        <Routes>
          <Route path="/task/:id" element={<TaskDetailPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(
      () => {
        expect(screen.getByText(/全部完成/)).toBeInTheDocument();
      },
      { timeout: 4000 }
    );

    expect(screen.getByText(/文章-m1/)).toBeInTheDocument();
    expect(screen.getByText(/文章-m2/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /自动评测/ }));

    await waitFor(
      () => {
        // 报告出现且 alias 被替换为模型名（这里 m1 在 MODEL_BY_ID 里没有 label，
        // 会回退到 modelId 字符串本身）
        expect(screen.getByText(/冠军：/)).toBeInTheDocument();
      },
      { timeout: 4000 }
    );
  });

  it('keeps writing_done even if one model fails', async () => {
    fetchMock.mockImplementation(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string);
      if (body.model === 'm1') {
        return new Response('boom', { status: 500 });
      }
      return buildSSEResponse([`ok-${body.model}`]);
    });

    const task = freshTask(['m1', 'm2']);
    await useTaskStore.getState().saveNew(task);

    render(
      <MemoryRouter initialEntries={[`/task/${task.id}?autostart=1`]}>
        <Routes>
          <Route path="/task/:id" element={<TaskDetailPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(
      () => {
        expect(screen.getByText(/全部完成/)).toBeInTheDocument();
      },
      { timeout: 4000 }
    );

    expect(screen.getByText(/ok-m2/)).toBeInTheDocument();
    // m1 错误状态应该被显示
    expect(screen.getByRole('button', { name: /重试此模型/ })).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: 跑集成测试**

Run: `pnpm test TaskDetailPage`
Expected: PASS, 2 tests passed.

- [ ] **Step 4: Commit**

```bash
git add tests/integration tests/fixtures
git commit -m "test(integration): cover writing + judging end-to-end + partial failure"
```

---

## Task 22: README + 最终验收

**Files:**
- Create: `README.md`

- [ ] **Step 1: README**

Create `README.md`:

```markdown
# 写作模型评测工具

让多个 AI 模型针对同一道写作题作答，再用一个评测者模型横向对比、打分、给出 markdown 报告。

## 启动

\`\`\`bash
pnpm install
cp .env.example .env.local        # 填入 VITE_LLM_API_KEY
pnpm dev                           # http://localhost:5173
\`\`\`

也可以不填环境变量，直接进 /settings 页面填写 API Key。

## 测试

\`\`\`bash
pnpm test            # 单跑一次
pnpm test:watch
\`\`\`

## 构建

\`\`\`bash
pnpm build           # 产物在 dist/
pnpm preview         # 本地预览构建产物
\`\`\`

## 部署

应用只是一个静态前端，部署任意 CDN/对象存储均可。

LLM Gateway 是 HTTP 协议，dev 通过 Vite 反代到 \`/api\`。生产部署时建议同源反代到 Gateway，避免 mixed-content 限制。

## 设计文档

- 设计：\`docs/superpowers/specs/2026-06-11-writing-eval-tool-design.md\`
- 实施计划：\`docs/superpowers/plans/2026-06-11-writing-eval-tool.md\`
```

- [ ] **Step 2: 全套测试**

Run: `pnpm test`
Expected: 所有单元 + 集成测试 PASS。

- [ ] **Step 3: 类型 check**

Run: `pnpm exec tsc -b --noEmit`
Expected: 无错误。

- [ ] **Step 4: 生产构建**

Run: `pnpm build`
Expected: 输出 dist/，无 TypeScript / Vite 错误。

- [ ] **Step 5: 启动 dev 进行手动验收**

Run: `pnpm dev`
手动验收清单：

- [ ] /settings 输入 API Key 后能保存。
- [ ] /new 填一道写作题，勾 2-3 个模型，点开始测试。
- [ ] /task/:id 看到每个模型卡片实时流式追加文字。
- [ ] 全部完成后，状态条变绿，【自动评测】按钮亮起。
- [ ] 切到"并排对比""Tab"视图，三种视图均可正常显示。
- [ ] 点【自动评测】，报告流式渲染出来。
- [ ] 报告中的"模型 A"被替换成真实模型名（开匿名模式时）。
- [ ] 刷新页面：候选文章和报告还在。
- [ ] /history 看到该任务，点删除能删除。
- [ ] 历史页【⤓ 全部导出】拿到 JSON，再【⤒ 导入】回来等价。

- [ ] **Step 6: Commit**

```bash
git add README.md
git commit -m "docs: add README with run/test/build/deploy instructions"
```

---

## 完成

- 所有 services / db / state 单元测试覆盖关键纯逻辑。
- TaskDetailPage 集成测试覆盖完整流程 + 部分失败场景。
- 5 个路由页齐全：Home / New / TaskDetail / History / Settings。
- 写作阶段：每个模型独立卡片实时流式输出，不互相阻塞。
- 评测阶段：用户手动点【自动评测】，所有候选文章一次性打包送给评测者。
- 历史任务：IndexedDB 持久化 + 导入导出 JSON。
- API key：环境变量 + localStorage 双轨。

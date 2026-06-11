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
    await useTaskStore.getState().deleteTask('tid').catch(() => {});
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
    await useTaskStore.getState().deleteTask('tid').catch(() => {});
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

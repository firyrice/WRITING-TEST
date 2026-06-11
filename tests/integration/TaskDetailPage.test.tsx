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
    expect(screen.getByRole('button', { name: /重试此模型/ })).toBeInTheDocument();
  });
});

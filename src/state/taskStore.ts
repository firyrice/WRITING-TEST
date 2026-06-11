import { create } from 'zustand';
import type { Task, TaskStatus, JudgeResult } from '@/types/task';
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

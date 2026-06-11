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

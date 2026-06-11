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

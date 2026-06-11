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

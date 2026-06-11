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

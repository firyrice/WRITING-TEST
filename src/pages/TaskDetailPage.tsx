import { useEffect, useMemo, useRef, useState } from 'react';
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
import type { Task } from '@/types/task';

export function TaskDetailPage() {
  const { id = '' } = useParams();
  const [params] = useSearchParams();
  const task = useTaskStore((s) => s.current);
  const loadTask = useTaskStore((s) => s.loadTask);
  const autostartedRef = useRef(false);

  const [view, setView] = useState<ViewMode>('grid');

  useEffect(() => {
    let alive = true;
    (async () => {
      const t = await loadTask(id);
      if (
        alive &&
        t &&
        params.get('autostart') === '1' &&
        t.status === 'idle' &&
        !autostartedRef.current
      ) {
        autostartedRef.current = true;
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

function exportTask(task: Task) {
  const data = JSON.stringify(task, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `task-${task.id}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

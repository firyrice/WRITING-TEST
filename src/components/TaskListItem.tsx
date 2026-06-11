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
  if (!task.judgeResult?.rawMarkdown) return null;
  const md = task.judgeResult.rawMarkdown;
  const m = md.match(/冠军[：:]\s*(模型\s*[A-Z]+)/);
  if (!m) return null;
  const alias = m[1].replace(/\s+/g, ' ');
  const cand = task.candidates.find((c) => c.alias === alias);
  return cand?.modelId ?? null;
}

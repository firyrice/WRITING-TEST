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

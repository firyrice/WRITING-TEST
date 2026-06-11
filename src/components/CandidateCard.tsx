import { useState } from 'react';
import { Card, CardHeader, CardBody } from './ui/Card';
import { StatusBadge } from './StatusBadge';
import { Button } from './ui/Button';
import { MODEL_BY_ID } from '@/constants/models';
import type { Candidate } from '@/types/task';
import { countChars, formatDuration } from '@/lib/format';

type Props = {
  candidate: Candidate;
  onRetry?: () => void;
  /** 'preview' = 卡片网格里只显示前几行；'full' = Tab/Split 视图全文 */
  mode?: 'preview' | 'full';
};

export function CandidateCard({ candidate: c, onRetry, mode = 'preview' }: Props) {
  const [expanded, setExpanded] = useState(false);
  const showFull = mode === 'full' || expanded;
  const label = MODEL_BY_ID[c.modelId]?.label ?? c.modelId;
  const elapsed =
    c.startedAt && c.finishedAt ? formatDuration(c.finishedAt - c.startedAt) : null;

  return (
    <Card className="flex flex-col h-full">
      <CardHeader className="flex items-center justify-between">
        <div className="flex flex-col">
          <span className="text-sm font-semibold">{label}</span>
          <span className="text-xs text-gray-500">
            {c.alias}
            {elapsed ? ` · ⏱ ${elapsed}` : null}
          </span>
        </div>
        <StatusBadge status={c.status} />
      </CardHeader>
      <CardBody className="flex-1">
        {c.status === 'error' ? (
          <div className="space-y-2">
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1">
              {c.errorMessage ?? '生成失败'}
            </div>
            {onRetry && (
              <Button size="sm" variant="secondary" onClick={onRetry}>
                重试此模型
              </Button>
            )}
          </div>
        ) : (
          <>
            <pre className={`whitespace-pre-wrap text-sm leading-6 ${showFull ? '' : 'line-clamp-6'}`}>
              {c.article || (c.status === 'streaming' ? '...' : '（暂无内容）')}
            </pre>
            {mode === 'preview' && c.article.length > 0 && (
              <button
                className="mt-2 text-xs text-brand hover:underline"
                onClick={() => setExpanded((v) => !v)}
              >
                {expanded ? '收起' : '展开全文 ▾'}
              </button>
            )}
            {c.status === 'done' && (
              <div className="mt-2 text-xs text-gray-500">{countChars(c.article)} 字</div>
            )}
          </>
        )}
      </CardBody>
    </Card>
  );
}

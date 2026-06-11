import { Badge } from './ui/Badge';
import type { CandidateStatus, TaskStatus } from '@/types/task';

type Props = { status: CandidateStatus | TaskStatus };

const map: Record<string, { tone: 'gray' | 'blue' | 'green' | 'red' | 'brand'; label: string; pulse?: boolean }> = {
  // candidate
  pending: { tone: 'gray', label: '等待' },
  streaming: { tone: 'blue', label: '写作中', pulse: true },
  done: { tone: 'green', label: '完成' },
  error: { tone: 'red', label: '错误' },
  // task
  idle: { tone: 'gray', label: '初始化' },
  writing: { tone: 'blue', label: '写作中', pulse: true },
  writing_done: { tone: 'brand', label: '待评测' },
  judging: { tone: 'blue', label: '评测中', pulse: true },
};

export function StatusBadge({ status }: Props) {
  const m = map[status] ?? { tone: 'gray' as const, label: status };
  return (
    <Badge tone={m.tone} pulse={m.pulse}>
      {m.label}
    </Badge>
  );
}

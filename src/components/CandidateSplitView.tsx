import type { Candidate } from '@/types/task';
import { CandidateCard } from './CandidateCard';

type Props = { candidates: Candidate[]; onRetry?: (modelId: string) => void };

export function CandidateSplitView({ candidates, onRetry }: Props) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {candidates.map((c) => (
        <div key={c.modelId} className="min-w-[360px] max-w-[480px] flex-1">
          <CandidateCard
            candidate={c}
            mode="full"
            onRetry={onRetry ? () => onRetry(c.modelId) : undefined}
          />
        </div>
      ))}
    </div>
  );
}

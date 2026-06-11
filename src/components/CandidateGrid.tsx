import type { Candidate } from '@/types/task';
import { CandidateCard } from './CandidateCard';

type Props = {
  candidates: Candidate[];
  onRetry?: (modelId: string) => void;
};

export function CandidateGrid({ candidates, onRetry }: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      {candidates.map((c) => (
        <CandidateCard
          key={c.modelId}
          candidate={c}
          mode="preview"
          onRetry={onRetry ? () => onRetry(c.modelId) : undefined}
        />
      ))}
    </div>
  );
}

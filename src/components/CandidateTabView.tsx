import { useState } from 'react';
import type { Candidate } from '@/types/task';
import { CandidateCard } from './CandidateCard';
import { MODEL_BY_ID } from '@/constants/models';
import { cn } from './ui/cn';

type Props = { candidates: Candidate[]; onRetry?: (modelId: string) => void };

export function CandidateTabView({ candidates, onRetry }: Props) {
  const [active, setActive] = useState<string>(candidates[0]?.modelId ?? '');
  const cur = candidates.find((c) => c.modelId === active) ?? candidates[0];
  return (
    <div>
      <div className="flex flex-wrap gap-1 mb-2 border-b border-gray-200">
        {candidates.map((c) => {
          const label = MODEL_BY_ID[c.modelId]?.label ?? c.modelId;
          return (
            <button
              key={c.modelId}
              onClick={() => setActive(c.modelId)}
              className={cn(
                'px-3 py-1.5 text-sm border-b-2 -mb-px',
                active === c.modelId
                  ? 'border-brand text-brand'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              )}
            >
              {label}
            </button>
          );
        })}
      </div>
      {cur && (
        <CandidateCard
          candidate={cur}
          mode="full"
          onRetry={onRetry ? () => onRetry(cur.modelId) : undefined}
        />
      )}
    </div>
  );
}

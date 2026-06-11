import { cn } from './ui/cn';

export type ViewMode = 'grid' | 'split' | 'tab';

const labels: Record<ViewMode, string> = {
  grid: '卡片网格',
  split: '并排对比',
  tab: 'Tab',
};

export function ViewSwitcher({ value, onChange }: { value: ViewMode; onChange: (v: ViewMode) => void }) {
  return (
    <div className="inline-flex rounded border border-gray-300 overflow-hidden">
      {(Object.keys(labels) as ViewMode[]).map((m) => (
        <button
          key={m}
          onClick={() => onChange(m)}
          className={cn(
            'px-3 py-1.5 text-sm',
            value === m ? 'bg-brand text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
          )}
        >
          {labels[m]}
        </button>
      ))}
    </div>
  );
}

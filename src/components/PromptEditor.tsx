import { Textarea } from './ui/Textarea';
import { Button } from './ui/Button';

type Props = {
  label?: string;
  value: string;
  onChange: (next: string) => void;
  rows?: number;
  placeholder?: string;
  onResetDefault?: () => void;
};

export function PromptEditor({ label, value, onChange, rows = 6, placeholder, onResetDefault }: Props) {
  return (
    <div>
      {label && (
        <div className="mb-1 flex items-center justify-between">
          <label className="text-sm font-medium text-gray-800">{label}</label>
          {onResetDefault && (
            <Button size="sm" variant="ghost" onClick={onResetDefault}>
              恢复默认
            </Button>
          )}
        </div>
      )}
      <Textarea rows={rows} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

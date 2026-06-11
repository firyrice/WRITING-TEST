import { Checkbox } from './ui/Checkbox';
import { Button } from './ui/Button';
import { MODELS } from '@/constants/models';

type Props = {
  selected: string[];
  onChange: (next: string[]) => void;
};

export function ModelCheckboxGrid({ selected, onChange }: Props) {
  const toggle = (id: string, on: boolean) => {
    onChange(on ? Array.from(new Set([...selected, id])) : selected.filter((s) => s !== id));
  };
  const allIds = MODELS.map((m) => m.id);
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm text-gray-600">
          已勾选 {selected.length} / {MODELS.length}
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => onChange(allIds)}>
            全选
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onChange([])}>
            全不选
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {MODELS.map((m) => (
          <Checkbox
            key={m.id}
            label={m.label}
            checked={selected.includes(m.id)}
            onChange={(e) => toggle(m.id, e.target.checked)}
          />
        ))}
      </div>
    </div>
  );
}

import { cn } from './cn';

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  label: React.ReactNode;
};

export function Checkbox({ label, className, ...rest }: Props) {
  return (
    <label className={cn('inline-flex items-center gap-2 cursor-pointer select-none', className)}>
      <input type="checkbox" className="h-4 w-4 accent-brand" {...rest} />
      <span className="text-sm">{label}</span>
    </label>
  );
}

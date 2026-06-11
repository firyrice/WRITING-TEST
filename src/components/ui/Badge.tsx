import { cn } from './cn';

type Tone = 'gray' | 'blue' | 'green' | 'red' | 'brand';

const tones: Record<Tone, string> = {
  gray: 'bg-gray-100 text-gray-700',
  blue: 'bg-blue-100 text-blue-700',
  green: 'bg-green-100 text-green-700',
  red: 'bg-red-100 text-red-700',
  brand: 'bg-brand/10 text-brand',
};

export function Badge({
  tone = 'gray',
  pulse,
  children,
}: {
  tone?: Tone;
  pulse?: boolean;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
        tones[tone],
        pulse && 'animate-pulse'
      )}
    >
      {children}
    </span>
  );
}

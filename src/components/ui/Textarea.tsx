import { forwardRef } from 'react';
import { cn } from './cn';

type Props = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = forwardRef<HTMLTextAreaElement, Props>(({ className, ...rest }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      'w-full rounded border border-gray-300 px-3 py-2 text-sm font-mono leading-6',
      'focus:outline-none focus:ring-2 focus:ring-brand/40',
      className
    )}
    {...rest}
  />
));
Textarea.displayName = 'Textarea';

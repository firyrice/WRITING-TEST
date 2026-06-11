import { forwardRef } from 'react';
import { cn } from './cn';

type Props = React.SelectHTMLAttributes<HTMLSelectElement>;

export const Select = forwardRef<HTMLSelectElement, Props>(({ className, children, ...rest }, ref) => (
  <select
    ref={ref}
    className={cn(
      'h-10 rounded border border-gray-300 bg-white px-3 text-sm',
      'focus:outline-none focus:ring-2 focus:ring-brand/40',
      className
    )}
    {...rest}
  >
    {children}
  </select>
));
Select.displayName = 'Select';

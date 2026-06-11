import { forwardRef } from 'react';
import { cn } from './cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const variants: Record<Variant, string> = {
  primary: 'bg-brand text-white hover:bg-brand-dark disabled:bg-gray-300',
  secondary: 'bg-white border border-gray-300 text-gray-900 hover:bg-gray-50 disabled:text-gray-400',
  ghost: 'bg-transparent text-gray-700 hover:bg-gray-100 disabled:text-gray-400',
  danger: 'bg-red-600 text-white hover:bg-red-700 disabled:bg-red-300',
};

const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-sm',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-6 text-base',
};

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
};

export const Button = forwardRef<HTMLButtonElement, Props>(
  ({ variant = 'primary', size = 'md', className, ...rest }, ref) => (
    <button
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center rounded-md transition-colors disabled:cursor-not-allowed',
        variants[variant],
        sizes[size],
        className
      )}
      {...rest}
    />
  )
);
Button.displayName = 'Button';

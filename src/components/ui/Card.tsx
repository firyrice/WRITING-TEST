import { cn } from './cn';

export function Card({ className, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded border border-gray-200 bg-white', className)} {...rest} />;
}

export function CardHeader({ className, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-4 py-3 border-b border-gray-200', className)} {...rest} />;
}

export function CardBody({ className, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-4 py-3', className)} {...rest} />;
}

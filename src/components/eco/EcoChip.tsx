import { cn } from '@/lib/utils';

interface EcoChipProps {
  variant?: 'default' | 'green' | 'yellow' | 'red' | 'blue' | 'outline';
  size?: 'sm' | 'md';
  children: React.ReactNode;
  className?: string;
}

const variantStyles = {
  default: 'bg-secondary text-secondary-foreground',
  green: 'bg-eco-green-light text-eco-green-dark',
  yellow: 'bg-eco-yellow-light text-eco-orange',
  red: 'bg-eco-red-light text-eco-red',
  blue: 'bg-sky-100 text-eco-blue',
  outline: 'border border-border bg-transparent text-muted-foreground',
};

const sizeStyles = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-3 py-1 text-sm',
};

export function EcoChip({ variant = 'default', size = 'md', children, className }: EcoChipProps) {
  return (
    <span className={cn(
      'inline-flex items-center gap-1 rounded-full font-semibold whitespace-nowrap',
      variantStyles[variant],
      sizeStyles[size],
      className
    )}>
      {children}
    </span>
  );
}

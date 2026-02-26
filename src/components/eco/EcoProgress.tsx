import { cn } from '@/lib/utils';

interface EcoProgressProps {
  value: number;
  max?: number;
  variant?: 'default' | 'success' | 'warning';
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

const barColors = {
  default: 'bg-primary',
  success: 'bg-eco-green',
  warning: 'bg-eco-yellow',
};

const sizeStyles = {
  sm: 'h-1.5',
  md: 'h-2.5',
  lg: 'h-4',
};

export function EcoProgress({ value, max = 100, variant = 'default', size = 'md', showLabel, className }: EcoProgressProps) {
  const pct = Math.min(100, (value / max) * 100);

  return (
    <div className={cn('w-full', className)}>
      {showLabel && (
        <div className="flex justify-between text-xs font-medium text-muted-foreground mb-1">
          <span>{value}</span>
          <span>{max}</span>
        </div>
      )}
      <div className={cn('w-full rounded-full bg-secondary overflow-hidden', sizeStyles[size])}>
        <div
          className={cn('h-full rounded-full transition-all duration-700 ease-out', barColors[variant])}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

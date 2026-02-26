import { cn } from '@/lib/utils';

interface EcoCardProps {
  variant?: 'default' | 'elevated' | 'glass' | 'gradient';
  className?: string;
  children: React.ReactNode;
  onClick?: () => void;
}

const variantStyles = {
  default: 'bg-card eco-shadow-md',
  elevated: 'bg-card eco-shadow-lg',
  glass: 'glass-card',
  gradient: 'eco-gradient text-primary-foreground eco-shadow-lg',
};

export function EcoCard({ variant = 'default', className, children, onClick }: EcoCardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'rounded-2xl p-4',
        variantStyles[variant],
        onClick && 'cursor-pointer hover:scale-[1.02] transition-transform',
        className
      )}
    >
      {children}
    </div>
  );
}

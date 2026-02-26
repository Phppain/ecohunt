import { useState } from 'react';
import { TrendingDown, TrendingUp, Sparkles, X } from 'lucide-react';
import { EcoCard } from '@/components/eco/EcoCard';

interface CityProgressCardProps {
  totalMissions: number;
  cleanedMissions: number;
  zonesCount: number;
  improvementPct: number;
}

export function CityProgressCard({ totalMissions, cleanedMissions, zonesCount, improvementPct }: CityProgressCardProps) {
  const [visible, setVisible] = useState(true);
  const isImproving = improvementPct > 0;

  if (!visible) return null;

  return (
    <EcoCard variant="glass" className="p-3 relative">
      <button
        onClick={() => setVisible(false)}
        className="absolute top-2 right-2 w-5 h-5 rounded-full bg-muted/60 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
      >
        <X className="w-3 h-3" />
      </button>
      <div className="flex items-center gap-3">
        <div className="relative">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isImproving ? 'bg-primary/20' : 'bg-destructive/20'}`}>
            {isImproving ? (
              <TrendingDown className="w-5 h-5 text-primary" />
            ) : (
              <TrendingUp className="w-5 h-5 text-destructive" />
            )}
          </div>
          {isImproving && (
            <Sparkles className="w-3 h-3 text-primary absolute -top-1 -right-1 animate-pulse" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-semibold text-foreground">
              {isImproving ? 'Город становится чище!' : 'Нужна помощь!'}
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            {cleanedMissions}/{totalMissions} миссий · {zonesCount} зон
          </p>
        </div>
        <div className="text-right">
          <div className={`text-lg font-bold ${isImproving ? 'text-primary' : 'text-destructive'}`}>
            {isImproving ? '-' : '+'}{Math.abs(improvementPct)}%
          </div>
          <p className="text-[10px] text-muted-foreground">за 7 дней</p>
        </div>
      </div>

      {/* Mini progress bar */}
      <div className="mt-2 h-1.5 rounded-full bg-secondary overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-1000 ease-out"
          style={{
            width: `${totalMissions > 0 ? (cleanedMissions / totalMissions) * 100 : 0}%`,
            background: 'linear-gradient(90deg, hsl(var(--primary)), hsl(142, 71%, 65%))',
          }}
        />
      </div>
    </EcoCard>
  );
}

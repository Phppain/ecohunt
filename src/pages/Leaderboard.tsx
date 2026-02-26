import { useState } from 'react';
import { Trophy, Crown, Star, Gift, Flame, TrendingUp, Trash2, Wind, RefreshCw } from 'lucide-react';
import { EcoCard } from '@/components/eco/EcoCard';
import { EcoChip } from '@/components/eco/EcoChip';
import { useLeaderboard, LeaderboardPeriod } from '@/hooks/use-leaderboard';
import { useAuth } from '@/lib/auth-context';

const periods: { label: string; value: LeaderboardPeriod }[] = [
  { label: 'День', value: 'daily' },
  { label: 'Неделя', value: 'weekly' },
  { label: 'Месяц', value: 'monthly' },
  { label: 'Всё время', value: 'all' },
];

const crownColors = ['text-eco-yellow', 'text-muted-foreground', 'text-eco-orange'];
const podiumOrder = [1, 0, 2]; // 2nd, 1st, 3rd

const avatarEmojis = ['🌿', '🌍', '♻️', '🌱', '🗑️', '🏆', '🌏', '👍', '🦎', '🐢'];

function getAvatarEmoji(userId: string) {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) hash = ((hash << 5) - hash + userId.charCodeAt(i)) | 0;
  return avatarEmojis[Math.abs(hash) % avatarEmojis.length];
}

export default function Leaderboard() {
  const [activePeriod, setActivePeriod] = useState<LeaderboardPeriod>('weekly');
  const { leaders, periodStats, loading, refetch } = useLeaderboard(activePeriod);
  const { user } = useAuth();

  const top3 = leaders.slice(0, 3);
  const rest = leaders.slice(3);
  const currentUserRank = leaders.findIndex((l) => l.user_id === user?.id) + 1;

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="eco-gradient px-4 pt-6 pb-16 rounded-b-3xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Trophy className="w-6 h-6 text-primary-foreground" />
            <h1 className="text-xl font-bold text-primary-foreground">Лидерборд</h1>
          </div>
          <button
            onClick={() => refetch()}
            className="w-8 h-8 rounded-full bg-primary-foreground/10 flex items-center justify-center"
          >
            <RefreshCw className={`w-4 h-4 text-primary-foreground ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Period tabs */}
        <div className="flex bg-primary-foreground/10 rounded-xl p-0.5">
          {periods.map((p) => (
            <button
              key={p.value}
              onClick={() => setActivePeriod(p.value)}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
                activePeriod === p.value
                  ? 'bg-card text-foreground eco-shadow-md'
                  : 'text-primary-foreground/70'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Period stats summary */}
        <div className="grid grid-cols-3 gap-2 mt-3">
          <div className="bg-primary-foreground/10 rounded-xl p-2 text-center">
            <Trash2 className="w-4 h-4 text-primary-foreground/80 mx-auto mb-0.5" />
            <p className="text-lg font-bold text-primary-foreground">{periodStats.total_missions}</p>
            <p className="text-[9px] text-primary-foreground/60">Миссий</p>
          </div>
          <div className="bg-primary-foreground/10 rounded-xl p-2 text-center">
            <TrendingUp className="w-4 h-4 text-primary-foreground/80 mx-auto mb-0.5" />
            <p className="text-lg font-bold text-primary-foreground">{periodStats.total_waste_kg} кг</p>
            <p className="text-[9px] text-primary-foreground/60">Мусора убрано</p>
          </div>
          <div className="bg-primary-foreground/10 rounded-xl p-2 text-center">
            <Wind className="w-4 h-4 text-primary-foreground/80 mx-auto mb-0.5" />
            <p className="text-lg font-bold text-primary-foreground">{periodStats.total_co2_kg} кг</p>
            <p className="text-[9px] text-primary-foreground/60">CO₂ сохранено</p>
          </div>
        </div>
      </div>

      {/* Top 3 Podium */}
      <div className="px-4 -mt-10">
        {top3.length >= 3 ? (
          <div className="flex items-end justify-center gap-3 mb-6">
            {podiumOrder.map((idx) => {
              const leader = top3[idx];
              const isFirst = idx === 0;
              return (
                <div key={idx} className={`flex flex-col items-center ${isFirst ? 'mb-4' : ''}`}>
                  <Crown className={`w-5 h-5 mb-1 ${crownColors[idx]}`} />
                  <div
                    className={`${isFirst ? 'w-20 h-20' : 'w-16 h-16'} rounded-2xl bg-card eco-shadow-lg flex items-center justify-center text-2xl border-2 ${
                      isFirst ? 'border-eco-yellow' : 'border-border'
                    }`}
                  >
                    {leader.avatar_url ? (
                      <img src={leader.avatar_url} alt="" className="w-full h-full rounded-2xl object-cover" />
                    ) : (
                      getAvatarEmoji(leader.user_id)
                    )}
                  </div>
                  <p className="text-sm font-bold text-foreground mt-2 truncate max-w-[80px]">{leader.username}</p>
                  <EcoChip variant="green" size="sm">{leader.points} EP</EcoChip>
                  {leader.streak_days > 0 && (
                    <div className="flex items-center gap-0.5 mt-1">
                      <Flame className="w-3 h-3 text-eco-orange" />
                      <span className="text-[10px] text-muted-foreground">{leader.streak_days}д</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <EcoCard className="p-6 text-center mb-4">
            <p className="text-sm text-muted-foreground">
              {loading ? 'Загрузка...' : 'Пока недостаточно участников для подиума. Будь первым! 🌱'}
            </p>
          </EcoCard>
        )}
      </div>

      {/* Current user rank */}
      {currentUserRank > 0 && (
        <div className="px-4 mb-3">
          <EcoCard variant="gradient" className="flex items-center gap-3 p-3">
            <span className="text-sm font-bold text-primary-foreground">Ты #{currentUserRank}</span>
            <div className="flex-1" />
            <span className="text-sm font-bold text-primary-foreground">
              {leaders[currentUserRank - 1]?.points} EP
            </span>
          </EcoCard>
        </div>
      )}

      {/* Ranking list */}
      <div className="px-4 space-y-2">
        {rest.map((entry, i) => (
          <EcoCard
            key={entry.user_id}
            className={`flex items-center gap-3 p-3 ${entry.user_id === user?.id ? 'ring-2 ring-primary' : ''}`}
          >
            <span className="w-8 text-center text-sm font-bold text-muted-foreground">
              #{i + 4}
            </span>
            <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center text-lg">
              {entry.avatar_url ? (
                <img src={entry.avatar_url} alt="" className="w-full h-full rounded-xl object-cover" />
              ) : (
                getAvatarEmoji(entry.user_id)
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">{entry.username}</p>
              <div className="flex gap-1.5 mt-0.5">
                <span className="text-[10px] text-eco-green font-medium">🟢{entry.green_missions}</span>
                <span className="text-[10px] text-eco-yellow font-medium">🟡{entry.yellow_missions}</span>
                <span className="text-[10px] text-eco-red font-medium">🔴{entry.red_missions}</span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold text-foreground">{entry.points}</p>
              <p className="text-[10px] text-muted-foreground">EcoPoints</p>
            </div>
          </EcoCard>
        ))}
        {rest.length === 0 && top3.length > 0 && (
          <p className="text-center text-sm text-muted-foreground py-4">Больше участников пока нет</p>
        )}
      </div>

      {/* Monthly reward banner */}
      <div className="px-4 mt-6">
        <EcoCard variant="gradient" className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-primary-foreground/20 flex items-center justify-center">
            <Gift className="w-6 h-6 text-primary-foreground" />
          </div>
          <div>
            <p className="text-sm font-bold text-primary-foreground">Награды месяца</p>
            <p className="text-xs text-primary-foreground/80">Топ-10 получают эксклюзивные эко-бейджи!</p>
          </div>
          <Star className="w-5 h-5 text-primary-foreground/60 ml-auto" />
        </EcoCard>
      </div>

      {/* Live indicator */}
      <div className="flex items-center justify-center gap-1.5 mt-4 mb-2">
        <div className="w-2 h-2 rounded-full bg-eco-green animate-pulse" />
        <span className="text-[10px] text-muted-foreground">Обновляется в реальном времени</span>
      </div>
    </div>
  );
}

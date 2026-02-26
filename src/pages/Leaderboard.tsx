import { useState } from 'react';
import { Trophy, Crown, Medal, Star, Gift } from 'lucide-react';
import { EcoCard } from '@/components/eco/EcoCard';
import { EcoChip } from '@/components/eco/EcoChip';
import logo from '@/assets/logo.jpeg';

const periods = ['Daily', 'Weekly', 'Monthly', 'Event'];

// Mock leaderboard data
const mockLeaders = [
  { rank: 1, name: 'EcoWarrior', points: 2450, avatar: '🌿', green: 12, yellow: 8, red: 3 },
  { rank: 2, name: 'GreenHero', points: 2180, avatar: '🌍', green: 10, yellow: 7, red: 4 },
  { rank: 3, name: 'CleanEarth', points: 1920, avatar: '♻️', green: 9, yellow: 6, red: 2 },
  { rank: 4, name: 'NatureLover', points: 1650, avatar: '🌱', green: 8, yellow: 5, red: 1 },
  { rank: 5, name: 'TrashBuster', points: 1400, avatar: '🗑️', green: 7, yellow: 4, red: 2 },
  { rank: 6, name: 'EcoChamp', points: 1200, avatar: '🏆', green: 6, yellow: 3, red: 1 },
  { rank: 7, name: 'PlanetSaver', points: 980, avatar: '🌏', green: 5, yellow: 3, red: 0 },
  { rank: 8, name: 'GreenThumb', points: 820, avatar: '👍', green: 4, yellow: 2, red: 1 },
];

const crownColors = ['text-eco-yellow', 'text-muted-foreground', 'text-eco-orange'];

export default function Leaderboard() {
  const [activePeriod, setActivePeriod] = useState(0);

  const top3 = mockLeaders.slice(0, 3);
  const rest = mockLeaders.slice(3);

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="eco-gradient px-4 pt-6 pb-16 rounded-b-3xl">
        <div className="flex items-center gap-2 mb-4">
          <Trophy className="w-6 h-6 text-primary-foreground" />
          <h1 className="text-xl font-bold text-primary-foreground">Leaderboard</h1>
        </div>

        {/* Period tabs */}
        <div className="flex bg-primary-foreground/10 rounded-xl p-0.5">
          {periods.map((period, i) => (
            <button
              key={period}
              onClick={() => setActivePeriod(i)}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
                activePeriod === i
                  ? 'bg-card text-foreground eco-shadow-md'
                  : 'text-primary-foreground/70'
              }`}
            >
              {period}
            </button>
          ))}
        </div>
      </div>

      {/* Top 3 */}
      <div className="px-4 -mt-10">
        <div className="flex items-end justify-center gap-3 mb-6">
          {[1, 0, 2].map((idx) => {
            const leader = top3[idx];
            const isFirst = idx === 0;
            return (
              <div key={idx} className={`flex flex-col items-center ${isFirst ? 'mb-4' : ''}`}>
                <Crown className={`w-5 h-5 mb-1 ${crownColors[idx]}`} />
                <div className={`${isFirst ? 'w-20 h-20' : 'w-16 h-16'} rounded-2xl bg-card eco-shadow-lg flex items-center justify-center text-2xl border-2 ${isFirst ? 'border-eco-yellow' : 'border-border'}`}>
                  {leader.avatar}
                </div>
                <p className="text-sm font-bold text-foreground mt-2">{leader.name}</p>
                <EcoChip variant="green" size="sm">{leader.points} EP</EcoChip>
              </div>
            );
          })}
        </div>
      </div>

      {/* Ranking list */}
      <div className="px-4 space-y-2">
        {rest.map((user) => (
          <EcoCard key={user.rank} className="flex items-center gap-3 p-3">
            <span className="w-8 text-center text-sm font-bold text-muted-foreground">
              #{user.rank}
            </span>
            <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center text-lg">
              {user.avatar}
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground">{user.name}</p>
              <div className="flex gap-1.5 mt-0.5">
                <span className="text-[10px] text-eco-green font-medium">🟢{user.green}</span>
                <span className="text-[10px] text-eco-yellow font-medium">🟡{user.yellow}</span>
                <span className="text-[10px] text-eco-red font-medium">🔴{user.red}</span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold text-foreground">{user.points}</p>
              <p className="text-[10px] text-muted-foreground">EcoPoints</p>
            </div>
          </EcoCard>
        ))}
      </div>

      {/* Monthly reward banner */}
      <div className="px-4 mt-6">
        <EcoCard variant="gradient" className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-primary-foreground/20 flex items-center justify-center">
            <Gift className="w-6 h-6 text-primary-foreground" />
          </div>
          <div>
            <p className="text-sm font-bold text-primary-foreground">Monthly Rewards</p>
            <p className="text-xs text-primary-foreground/80">Top 10 earn exclusive eco badges!</p>
          </div>
          <Star className="w-5 h-5 text-primary-foreground/60 ml-auto" />
        </EcoCard>
      </div>
    </div>
  );
}

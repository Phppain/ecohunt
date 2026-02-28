import { useEffect, useState } from 'react';
import { Leaf, Zap, Flame, Target, Award, LogOut, Settings, Trash2, Wind } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/integrations/supabase/client';
import { EcoCard } from '@/components/eco/EcoCard';
import { EcoChip } from '@/components/eco/EcoChip';
import { EcoProgress } from '@/components/eco/EcoProgress';
import { EcoButton } from '@/components/eco/EcoButton';
import { useNavigate } from 'react-router-dom';

interface ProfileData {
  username: string;
  avatar_url: string | null;
}

interface StatsData {
  total_points: number;
  level: number;
  streak_days: number;
  weekly_points: number;
  monthly_points: number;
}

const achievements = [
  { icon: '🌱', label: 'First Clean' },
  { icon: '🔥', label: '7-Day Streak' },
  { icon: '🏆', label: 'Top 10' },
  { icon: '♻️', label: '100 Items' },
  { icon: '🌍', label: 'Zone Master' },
];

export default function Profile() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [ecoStats, setEcoStats] = useState({ waste_kg: 0, co2_kg: 0, missions_count: 0 });
  const [activeMissions, setActiveMissions] = useState<{ title: string; progress: number; status: string }[]>([]);

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      // Fetch profile, stats, and missions in parallel
      const [profileRes, statsRes, missionsRes] = await Promise.all([
        supabase.from('profiles').select('username, avatar_url').eq('user_id', user.id).single(),
        supabase.from('user_stats').select('*').eq('user_id', user.id).single(),
        supabase.from('missions').select('id, title, status, cleanup_progress_pct').eq('creator_id', user.id),
      ]);

      if (profileRes.data) setProfile(profileRes.data as ProfileData);
      if (statsRes.data) setStats(statsRes.data as unknown as StatsData);

      // Active missions from real data
      const allMissions = missionsRes.data || [];
      const active = allMissions
        .filter(m => m.status === 'IN_PROGRESS' || m.status === 'OPEN')
        .map(m => ({
          title: m.title || 'Миссия',
          progress: m.cleanup_progress_pct || 0,
          status: m.status,
        }));
      setActiveMissions(active);

      // Eco impact: sum from mission_analysis for all CLEANED missions (all time)
      const cleanedIds = allMissions.filter(m => m.status === 'CLEANED').map(m => m.id);
      if (cleanedIds.length > 0) {
        const { data: analyses } = await supabase
          .from('mission_analysis')
          .select('waste_diverted_kg, co2_saved_kg')
          .in('mission_id', cleanedIds);

        let wasteKg = 0, co2Kg = 0;
        (analyses || []).forEach(a => {
          wasteKg += a.waste_diverted_kg;
          co2Kg += a.co2_saved_kg;
        });
        setEcoStats({
          waste_kg: Math.round(wasteKg * 100) / 100,
          co2_kg: Math.round(co2Kg * 100) / 100,
          missions_count: cleanedIds.length,
        });
      } else {
        setEcoStats({ waste_kg: 0, co2_kg: 0, missions_count: 0 });
      }
    };
    fetchData();
  }, [user]);

  if (!user) {
    navigate('/auth');
    return null;
  }

  const username = profile?.username || user.email?.split('@')[0] || 'User';
  const s = stats || { total_points: 0, level: 1, streak_days: 0, weekly_points: 0, monthly_points: 0 };
  const xpForNext = s.level * 500;
  const currentXp = s.total_points % 500;

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="eco-gradient px-4 pt-6 pb-12 rounded-b-3xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold text-primary-foreground">Profile</h1>
          <div className="flex gap-2">
            <button className="w-9 h-9 rounded-xl bg-primary-foreground/10 flex items-center justify-center text-primary-foreground">
              <Settings className="w-4 h-4" />
            </button>
            <button
              onClick={async () => { await signOut(); navigate('/auth'); }}
              className="w-9 h-9 rounded-xl bg-primary-foreground/10 flex items-center justify-center text-primary-foreground"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-primary-foreground/20 flex items-center justify-center text-3xl border-2 border-primary-foreground/30">
            🌿
          </div>
          <div>
            <h2 className="text-lg font-bold text-primary-foreground">{username}</h2>
            <EcoChip variant="green" size="sm" className="bg-primary-foreground/20 text-primary-foreground">
              Level {s.level}
            </EcoChip>
            <EcoProgress value={currentXp} max={500} size="sm" className="mt-2 w-40 [&_div]:bg-primary-foreground/20 [&_div_div]:bg-primary-foreground" />
          </div>
        </div>
      </div>

      <div className="px-4 -mt-6 space-y-4 animate-slide-up">
        {/* Points summary */}
        <div className="grid grid-cols-3 gap-3">
          <EcoCard variant="elevated" className="text-center py-4">
            <Zap className="w-5 h-5 text-eco-yellow mx-auto mb-1" />
            <p className="text-lg font-bold text-foreground">{s.total_points}</p>
            <p className="text-[10px] text-muted-foreground">Total EP</p>
          </EcoCard>
          <EcoCard variant="elevated" className="text-center py-4">
            <Leaf className="w-5 h-5 text-primary mx-auto mb-1" />
            <p className="text-lg font-bold text-foreground">{s.weekly_points}</p>
            <p className="text-[10px] text-muted-foreground">This Week</p>
          </EcoCard>
          <EcoCard variant="elevated" className="text-center py-4">
            <Target className="w-5 h-5 text-eco-blue mx-auto mb-1" />
            <p className="text-lg font-bold text-foreground">{s.monthly_points}</p>
            <p className="text-[10px] text-muted-foreground">This Month</p>
          </EcoCard>
        </div>

        {/* Eco Impact — real data only */}
        <div className="grid grid-cols-3 gap-3">
          <EcoCard variant="elevated" className="text-center py-4">
            <Trash2 className="w-5 h-5 text-eco-orange mx-auto mb-1" />
            <p className="text-lg font-bold text-foreground">{ecoStats.waste_kg}</p>
            <p className="text-[10px] text-muted-foreground">кг убрано</p>
          </EcoCard>
          <EcoCard variant="elevated" className="text-center py-4">
            <Wind className="w-5 h-5 text-primary mx-auto mb-1" />
            <p className="text-lg font-bold text-foreground">{ecoStats.co2_kg}</p>
            <p className="text-[10px] text-muted-foreground">кг CO₂</p>
          </EcoCard>
          <EcoCard variant="elevated" className="text-center py-4">
            <Target className="w-5 h-5 text-eco-green mx-auto mb-1" />
            <p className="text-lg font-bold text-foreground">{ecoStats.missions_count}</p>
            <p className="text-[10px] text-muted-foreground">Миссий</p>
          </EcoCard>
        </div>

        {/* Eco streak */}
        <EcoCard variant="gradient" className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-primary-foreground/20 flex items-center justify-center">
            <Flame className="w-6 h-6 text-primary-foreground" />
          </div>
          <div>
            <p className="text-sm font-bold text-primary-foreground">Eco Streak</p>
            <p className="text-2xl font-bold text-primary-foreground">{s.streak_days} days 🔥</p>
          </div>
        </EcoCard>

        {/* Active missions — real data */}
        <EcoCard>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-bold text-foreground">Active Missions</p>
            <EcoChip variant="green" size="sm">{activeMissions.length}</EcoChip>
          </div>
          {activeMissions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-3">Нет активных миссий</p>
          ) : (
            <div className="space-y-3">
              {activeMissions.map((m, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center">
                    <Target className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-foreground">{m.title}</p>
                    <EcoProgress value={m.progress} size="sm" variant="success" className="mt-1" />
                  </div>
                  <span className="text-xs text-muted-foreground">{m.progress}%</span>
                </div>
              ))}
            </div>
          )}
        </EcoCard>

        {/* Achievements */}
        <EcoCard>
          <div className="flex items-center gap-2 mb-3">
            <Award className="w-4 h-4 text-eco-yellow" />
            <p className="text-sm font-bold text-foreground">Achievements</p>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {achievements.map((a, i) => (
              <div key={i} className="flex flex-col items-center gap-1 min-w-[56px]">
                <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center text-xl">
                  {a.icon}
                </div>
                <span className="text-[10px] text-muted-foreground text-center">{a.label}</span>
              </div>
            ))}
          </div>
        </EcoCard>
      </div>
    </div>
  );
}

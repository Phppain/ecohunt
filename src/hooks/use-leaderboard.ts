import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type LeaderboardPeriod = 'daily' | 'weekly' | 'monthly' | 'all';

export interface LeaderboardEntry {
  user_id: string;
  username: string;
  avatar_url: string | null;
  points: number;
  level: number;
  streak_days: number;
  missions_completed: number;
  green_missions: number;
  yellow_missions: number;
  red_missions: number;
  waste_kg: number;
  co2_kg: number;
}

export interface PeriodStats {
  total_missions: number;
  total_waste_kg: number;
  total_co2_kg: number;
  total_items_cleaned: number;
}

function getPeriodStart(period: LeaderboardPeriod): string | null {
  const now = new Date();
  if (period === 'daily') return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  if (period === 'weekly') return new Date(now.getTime() - 7 * 86400000).toISOString();
  if (period === 'monthly') return new Date(now.getTime() - 30 * 86400000).toISOString();
  return null; // 'all'
}

export function useLeaderboard(period: LeaderboardPeriod) {
  const [leaders, setLeaders] = useState<LeaderboardEntry[]>([]);
  const [periodStats, setPeriodStats] = useState<PeriodStats>({
    total_missions: 0, total_waste_kg: 0, total_co2_kg: 0, total_items_cleaned: 0,
  });
  const [loading, setLoading] = useState(true);

  const fetchLeaderboard = useCallback(async () => {
    try {
      const periodStart = getPeriodStart(period);

      // 1. Get all CLEANED missions (filtered by period if needed)
      let missionsQuery = supabase
        .from('missions')
        .select('id, creator_id, severity_color, updated_at')
        .eq('status', 'CLEANED');
      if (periodStart) missionsQuery = missionsQuery.gte('updated_at', periodStart);

      const { data: missions } = await missionsQuery;
      if (!missions || missions.length === 0) {
        setLeaders([]);
        setPeriodStats({ total_missions: 0, total_waste_kg: 0, total_co2_kg: 0, total_items_cleaned: 0 });
        setLoading(false);
        return;
      }

      const missionIds = missions.map(m => m.id);
      const creatorIds = [...new Set(missions.map(m => m.creator_id))];

      // 2. Fetch profiles, user_stats, and analysis in parallel
      const [{ data: profiles }, { data: statsData }, { data: analyses }] = await Promise.all([
        supabase.from('profiles').select('user_id, username, avatar_url').in('user_id', creatorIds),
        supabase.from('user_stats').select('user_id, level, streak_days, total_points, weekly_points, monthly_points').in('user_id', creatorIds),
        supabase.from('mission_analysis').select('mission_id, waste_diverted_kg, co2_saved_kg, items_before, items_after').in('mission_id', missionIds),
      ]);

      const profileMap = new Map((profiles || []).map(p => [p.user_id, p]));
      const statsMap = new Map((statsData || []).map(s => [s.user_id, s]));
      const analysisMap = new Map((analyses || []).map(a => [a.mission_id, a]));

      // 3. Group missions by creator
      const missionsByUser = new Map<string, typeof missions>();
      missions.forEach(m => {
        if (!missionsByUser.has(m.creator_id)) missionsByUser.set(m.creator_id, []);
        missionsByUser.get(m.creator_id)!.push(m);
      });

      // 4. Build entries
      const entries: LeaderboardEntry[] = creatorIds.map(uid => {
        const profile = profileMap.get(uid);
        const stats = statsMap.get(uid);
        const userMissions = missionsByUser.get(uid) || [];
        let green = 0, yellow = 0, red = 0, wasteKg = 0, co2Kg = 0;

        userMissions.forEach(m => {
          const sev = m.severity_color || 'GREEN';
          if (sev === 'GREEN') green++; else if (sev === 'YELLOW') yellow++; else red++;
          const a = analysisMap.get(m.id);
          if (a) { wasteKg += a.waste_diverted_kg; co2Kg += a.co2_saved_kg; }
        });

        // Points: use period-specific from user_stats
        let points = stats?.total_points || 0;
        if (period === 'weekly') points = stats?.weekly_points || 0;
        else if (period === 'monthly') points = stats?.monthly_points || 0;
        else if (period === 'daily') points = 0; // will override below

        return {
          user_id: uid,
          username: profile?.username || 'Unknown',
          avatar_url: profile?.avatar_url || null,
          points,
          level: stats?.level || 1,
          streak_days: stats?.streak_days || 0,
          missions_completed: userMissions.length,
          green_missions: green, yellow_missions: yellow, red_missions: red,
          waste_kg: Math.round(wasteKg * 10) / 10,
          co2_kg: Math.round(co2Kg * 10) / 10,
        };
      });

      // 5. For daily: override points from points_log
      if (period === 'daily' && periodStart) {
        const { data: todayLogs } = await supabase
          .from('points_log')
          .select('user_id, points')
          .gte('created_at', periodStart);
        const dailyPoints = new Map<string, number>();
        (todayLogs || []).forEach(l => {
          dailyPoints.set(l.user_id, (dailyPoints.get(l.user_id) || 0) + l.points);
        });
        entries.forEach(e => { e.points = dailyPoints.get(e.user_id) || 0; });
      }

      entries.sort((a, b) => b.points - a.points || b.waste_kg - a.waste_kg);
      setLeaders(entries);

      // 6. Period stats
      const totalWaste = entries.reduce((s, e) => s + e.waste_kg, 0);
      const totalCo2 = entries.reduce((s, e) => s + e.co2_kg, 0);
      setPeriodStats({
        total_missions: missions.length,
        total_waste_kg: Math.round(totalWaste * 10) / 10,
        total_co2_kg: Math.round(totalCo2 * 10) / 10,
        total_items_cleaned: 0,
      });
    } catch (err) {
      console.error('Leaderboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    setLoading(true);
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  useEffect(() => {
    const channel = supabase
      .channel('leaderboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_stats' }, () => fetchLeaderboard())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'points_log' }, () => fetchLeaderboard())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchLeaderboard]);

  return { leaders, periodStats, loading, refetch: fetchLeaderboard };
}

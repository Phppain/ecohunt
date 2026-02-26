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
}

export interface PeriodStats {
  total_missions: number;
  total_waste_kg: number;
  total_co2_kg: number;
  total_items_cleaned: number;
}

export function useLeaderboard(period: LeaderboardPeriod) {
  const [leaders, setLeaders] = useState<LeaderboardEntry[]>([]);
  const [periodStats, setPeriodStats] = useState<PeriodStats>({
    total_missions: 0,
    total_waste_kg: 0,
    total_co2_kg: 0,
    total_items_cleaned: 0,
  });
  const [loading, setLoading] = useState(true);

  const fetchLeaderboard = useCallback(async () => {
    try {
      // Fetch user stats + profiles
      const { data: statsData, error: statsError } = await supabase
        .from('user_stats')
        .select('user_id, total_points, weekly_points, monthly_points, level, streak_days')
        .order(
          period === 'weekly' ? 'weekly_points' : period === 'monthly' ? 'monthly_points' : 'total_points',
          { ascending: false }
        )
        .limit(50);

      if (statsError) throw statsError;
      if (!statsData || statsData.length === 0) {
        setLeaders([]);
        setLoading(false);
        return;
      }

      const userIds = statsData.map((s) => s.user_id);

      // Fetch profiles
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, username, avatar_url')
        .in('user_id', userIds);

      const profileMap = new Map(
        (profiles || []).map((p) => [p.user_id, p])
      );

      // Fetch mission counts per user with zone severity
      const { data: missions } = await supabase
        .from('missions')
        .select('creator_id, status, zone_id, zones(severity)')
        .eq('status', 'CLEANED')
        .in('creator_id', userIds);

      // Count missions by severity per user
      const missionCounts = new Map<string, { total: number; green: number; yellow: number; red: number }>();
      (missions || []).forEach((m: any) => {
        const uid = m.creator_id;
        if (!missionCounts.has(uid)) missionCounts.set(uid, { total: 0, green: 0, yellow: 0, red: 0 });
        const c = missionCounts.get(uid)!;
        c.total++;
        const sev = m.zones?.severity || 'GREEN';
        if (sev === 'GREEN') c.green++;
        else if (sev === 'YELLOW') c.yellow++;
        else c.red++;
      });

      // Build entries
      const entries: LeaderboardEntry[] = statsData.map((s) => {
        const profile = profileMap.get(s.user_id);
        const mc = missionCounts.get(s.user_id) || { total: 0, green: 0, yellow: 0, red: 0 };
        const points = period === 'weekly' ? s.weekly_points : period === 'monthly' ? s.monthly_points : s.total_points;
        return {
          user_id: s.user_id,
          username: profile?.username || 'Unknown',
          avatar_url: profile?.avatar_url || null,
          points,
          level: s.level,
          streak_days: s.streak_days,
          missions_completed: mc.total,
          green_missions: mc.green,
          yellow_missions: mc.yellow,
          red_missions: mc.red,
        };
      });

      // Sort by points (for daily we use total_points with date filter)
      entries.sort((a, b) => b.points - a.points);
      setLeaders(entries);

      // Fetch period stats
      let missionQuery = supabase.from('missions').select('id', { count: 'exact' }).eq('status', 'CLEANED');
      const now = new Date();
      if (period === 'daily') {
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
        missionQuery = missionQuery.gte('updated_at', today);
      } else if (period === 'weekly') {
        const weekAgo = new Date(now.getTime() - 7 * 86400000).toISOString();
        missionQuery = missionQuery.gte('updated_at', weekAgo);
      } else if (period === 'monthly') {
        const monthAgo = new Date(now.getTime() - 30 * 86400000).toISOString();
        missionQuery = missionQuery.gte('updated_at', monthAgo);
      }
      const { count: missionCount } = await missionQuery;

      // Fetch analysis stats
      const { data: analysisData } = await supabase
        .from('mission_analysis')
        .select('waste_diverted_kg, co2_saved_kg, items_before, items_after');

      let totalWaste = 0, totalCo2 = 0, totalItems = 0;
      (analysisData || []).forEach((a) => {
        totalWaste += a.waste_diverted_kg;
        totalCo2 += a.co2_saved_kg;
        totalItems += Math.max(0, a.items_before - a.items_after);
      });

      setPeriodStats({
        total_missions: missionCount || 0,
        total_waste_kg: Math.round(totalWaste * 10) / 10,
        total_co2_kg: Math.round(totalCo2 * 10) / 10,
        total_items_cleaned: totalItems,
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

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('leaderboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_stats' }, () => {
        fetchLeaderboard();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'points_log' }, () => {
        fetchLeaderboard();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchLeaderboard]);

  return { leaders, periodStats, loading, refetch: fetchLeaderboard };
}

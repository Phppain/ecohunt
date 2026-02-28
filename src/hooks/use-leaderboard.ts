import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  type Period,
  type UserAggregation,
  type GlobalStats,
  getPeriodRange,
  aggregateGlobalStats,
  sortLeaderboard,
} from '@/lib/eco-calculations';

export type LeaderboardPeriod = Period;

export function useLeaderboard(period: LeaderboardPeriod) {
  const [leaders, setLeaders] = useState<UserAggregation[]>([]);
  const [globalStats, setGlobalStats] = useState<GlobalStats>({
    total_missions: 0, total_eco_points: 0, total_trash_kg: 0, total_co2_kg: 0,
  });
  const [loading, setLoading] = useState(true);

  const fetchLeaderboard = useCallback(async () => {
    try {
      setLoading(true);
      const { from } = getPeriodRange(period);

      // 1. Get CLEANED missions in period
      let missionsQuery = supabase
        .from('missions')
        .select('id, creator_id, severity_color, updated_at')
        .eq('status', 'CLEANED');
      if (from) missionsQuery = missionsQuery.gte('updated_at', from);

      const { data: missions } = await missionsQuery;
      if (!missions || missions.length === 0) {
        setLeaders([]);
        setGlobalStats({ total_missions: 0, total_eco_points: 0, total_trash_kg: 0, total_co2_kg: 0 });
        setLoading(false);
        return;
      }

      const missionIds = missions.map(m => m.id);
      const creatorIds = [...new Set(missions.map(m => m.creator_id))];

      // 2. Fetch related data in parallel
      // Points: always from points_log filtered by period (single source of truth)
      let pointsQuery = supabase
        .from('points_log')
        .select('user_id, points, mission_id')
        .in('user_id', creatorIds);
      if (from) pointsQuery = pointsQuery.gte('created_at', from);

      const [{ data: profiles }, { data: statsData }, { data: analyses }, { data: pointsLogs }] = await Promise.all([
        supabase.from('profiles').select('user_id, username, avatar_url').in('user_id', creatorIds),
        supabase.from('user_stats').select('user_id, level, streak_days').in('user_id', creatorIds),
        supabase.from('mission_analysis').select('mission_id, waste_diverted_kg, co2_saved_kg').in('mission_id', missionIds),
        pointsQuery,
      ]);

      const profileMap = new Map((profiles || []).map(p => [p.user_id, p]));
      const statsMap = new Map((statsData || []).map(s => [s.user_id, s]));
      const analysisMap = new Map((analyses || []).map(a => [a.mission_id, a]));

      // Sum points per user from points_log (the real source)
      const userPoints = new Map<string, number>();
      (pointsLogs || []).forEach(l => {
        userPoints.set(l.user_id, (userPoints.get(l.user_id) || 0) + l.points);
      });

      // 3. Group missions by creator
      const missionsByUser = new Map<string, typeof missions>();
      missions.forEach(m => {
        if (!missionsByUser.has(m.creator_id)) missionsByUser.set(m.creator_id, []);
        missionsByUser.get(m.creator_id)!.push(m);
      });

      // 4. Build aggregation per user — all from real data
      const entries: UserAggregation[] = creatorIds.map(uid => {
        const profile = profileMap.get(uid);
        const stats = statsMap.get(uid);
        const userMissions = missionsByUser.get(uid) || [];

        let green = 0, yellow = 0, red = 0, trashKg = 0, co2Kg = 0;
        userMissions.forEach(m => {
          const sev = (m.severity_color || 'GREEN').toUpperCase();
          if (sev === 'GREEN') green++;
          else if (sev === 'YELLOW') yellow++;
          else red++;

          const a = analysisMap.get(m.id);
          if (a) {
            trashKg += a.waste_diverted_kg;
            co2Kg += a.co2_saved_kg;
          }
          // If no analysis record exists, we add 0 — no fake data
        });

        return {
          user_id: uid,
          username: profile?.username || 'Unknown',
          avatar_url: profile?.avatar_url || null,
          eco_points: userPoints.get(uid) || 0,
          trash_kg: Math.round(trashKg * 100) / 100,
          co2_kg: Math.round(co2Kg * 100) / 100,
          missions_count: userMissions.length,
          green_count: green,
          yellow_count: yellow,
          red_count: red,
          streak_days: stats?.streak_days || 0,
          level: stats?.level || 1,
        };
      });

      const sorted = sortLeaderboard(entries);
      setLeaders(sorted);
      setGlobalStats(aggregateGlobalStats(sorted));
    } catch (err) {
      console.error('Leaderboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  useEffect(() => {
    const channel = supabase
      .channel('leaderboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'missions' }, () => fetchLeaderboard())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'points_log' }, () => fetchLeaderboard())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mission_analysis' }, () => fetchLeaderboard())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchLeaderboard]);

  return { leaders, globalStats, loading, refetch: fetchLeaderboard };
}

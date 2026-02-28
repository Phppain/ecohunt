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
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const weekAgo = new Date(now.getTime() - 7 * 86400000).toISOString();
      const monthAgo = new Date(now.getTime() - 30 * 86400000).toISOString();

      if (period === 'daily') {
        // For daily: sum points_log from today only
        const { data: todayLogs } = await supabase
          .from('points_log')
          .select('user_id, points, mission_id')
          .gte('created_at', todayStart);

        const userPoints = new Map<string, number>();
        const userMissionIds = new Map<string, Set<string>>();
        (todayLogs || []).forEach((log) => {
          userPoints.set(log.user_id, (userPoints.get(log.user_id) || 0) + log.points);
          if (log.mission_id) {
            if (!userMissionIds.has(log.user_id)) userMissionIds.set(log.user_id, new Set());
            userMissionIds.get(log.user_id)!.add(log.mission_id);
          }
        });

        if (userPoints.size === 0) {
          setLeaders([]);
          setPeriodStats({ total_missions: 0, total_waste_kg: 0, total_co2_kg: 0, total_items_cleaned: 0 });
          setLoading(false);
          return;
        }

        const userIds = Array.from(userPoints.keys());
        const [{ data: profiles }, { data: statsData }] = await Promise.all([
          supabase.from('profiles').select('user_id, username, avatar_url').in('user_id', userIds),
          supabase.from('user_stats').select('user_id, level, streak_days').in('user_id', userIds),
        ]);

        const profileMap = new Map((profiles || []).map(p => [p.user_id, p]));
        const statsMap = new Map((statsData || []).map(s => [s.user_id, s]));

        // Get all mission IDs for today to fetch analysis
        const allMissionIds = new Set<string>();
        userMissionIds.forEach(ids => ids.forEach(id => allMissionIds.add(id)));
        const missionIdArr = Array.from(allMissionIds);

        const [{ data: missions }, { data: analyses }] = await Promise.all([
          missionIdArr.length > 0
            ? supabase.from('missions').select('id, creator_id, severity_color').in('id', missionIdArr)
            : Promise.resolve({ data: [] }),
          missionIdArr.length > 0
            ? supabase.from('mission_analysis').select('mission_id, waste_diverted_kg, co2_saved_kg, items_before, items_after').in('mission_id', missionIdArr)
            : Promise.resolve({ data: [] }),
        ]);

        const missionSeverityMap = new Map((missions || []).map(m => [m.id, m]));
        const analysisMap = new Map((analyses || []).map(a => [a.mission_id, a]));

        const entries: LeaderboardEntry[] = userIds.map(uid => {
          const profile = profileMap.get(uid);
          const stats = statsMap.get(uid);
          const mIds = userMissionIds.get(uid) || new Set();
          let green = 0, yellow = 0, red = 0, wasteKg = 0, co2Kg = 0;
          mIds.forEach(mid => {
            const m = missionSeverityMap.get(mid);
            const sev = m?.severity_color || 'GREEN';
            if (sev === 'GREEN') green++; else if (sev === 'YELLOW') yellow++; else red++;
            const a = analysisMap.get(mid);
            if (a) { wasteKg += a.waste_diverted_kg; co2Kg += a.co2_saved_kg; }
          });
          return {
            user_id: uid,
            username: profile?.username || 'Unknown',
            avatar_url: profile?.avatar_url || null,
            points: userPoints.get(uid) || 0,
            level: stats?.level || 1,
            streak_days: stats?.streak_days || 0,
            missions_completed: mIds.size,
            green_missions: green, yellow_missions: yellow, red_missions: red,
            waste_kg: Math.round(wasteKg * 10) / 10,
            co2_kg: Math.round(co2Kg * 10) / 10,
          };
        });

        entries.sort((a, b) => b.points - a.points);
        setLeaders(entries);

        // Period stats for today
        const todayMissions = await supabase.from('missions').select('id', { count: 'exact' }).eq('status', 'CLEANED').gte('updated_at', todayStart);
        const totalWaste = entries.reduce((s, e) => s + e.waste_kg, 0);
        const totalCo2 = entries.reduce((s, e) => s + e.co2_kg, 0);
        setPeriodStats({
          total_missions: todayMissions.count || 0,
          total_waste_kg: Math.round(totalWaste * 10) / 10,
          total_co2_kg: Math.round(totalCo2 * 10) / 10,
          total_items_cleaned: 0,
        });
      } else {
        // Weekly / Monthly / All — use user_stats points
        const pointsCol = period === 'weekly' ? 'weekly_points' : period === 'monthly' ? 'monthly_points' : 'total_points';
        const { data: statsData, error: statsError } = await supabase
          .from('user_stats')
          .select('user_id, total_points, weekly_points, monthly_points, level, streak_days')
          .order(pointsCol, { ascending: false })
          .limit(50);

        if (statsError) throw statsError;
        if (!statsData || statsData.length === 0) { setLeaders([]); setLoading(false); return; }

        const userIds = statsData.map(s => s.user_id);
        const [{ data: profiles }, { data: missions }] = await Promise.all([
          supabase.from('profiles').select('user_id, username, avatar_url').in('user_id', userIds),
          supabase.from('missions').select('id, creator_id, status, severity_color').eq('status', 'CLEANED').in('creator_id', userIds),
        ]);

        const profileMap = new Map((profiles || []).map(p => [p.user_id, p]));

        // Get mission IDs for analysis
        const cleanedMissionIds = (missions || []).map(m => m.id);
        const { data: analyses } = cleanedMissionIds.length > 0
          ? await supabase.from('mission_analysis').select('mission_id, waste_diverted_kg, co2_saved_kg, items_before, items_after').in('mission_id', cleanedMissionIds)
          : { data: [] };
        const analysisMap = new Map((analyses || []).map(a => [a.mission_id, a]));

        // Group missions by creator
        const missionsByUser = new Map<string, typeof missions>();
        (missions || []).forEach(m => {
          if (!missionsByUser.has(m.creator_id)) missionsByUser.set(m.creator_id, []);
          missionsByUser.get(m.creator_id)!.push(m);
        });

        const entries: LeaderboardEntry[] = statsData.map(s => {
          const profile = profileMap.get(s.user_id);
          const userMissions = missionsByUser.get(s.user_id) || [];
          let green = 0, yellow = 0, red = 0, wasteKg = 0, co2Kg = 0;
          userMissions.forEach((m: any) => {
            const sev = m.severity_color || 'GREEN';
            if (sev === 'GREEN') green++; else if (sev === 'YELLOW') yellow++; else red++;
            const a = analysisMap.get(m.id);
            if (a) { wasteKg += a.waste_diverted_kg; co2Kg += a.co2_saved_kg; }
          });
          const points = period === 'weekly' ? s.weekly_points : period === 'monthly' ? s.monthly_points : s.total_points;
          return {
            user_id: s.user_id,
            username: profile?.username || 'Unknown',
            avatar_url: profile?.avatar_url || null,
            points, level: s.level, streak_days: s.streak_days,
            missions_completed: userMissions.length,
            green_missions: green, yellow_missions: yellow, red_missions: red,
            waste_kg: Math.round(wasteKg * 10) / 10,
            co2_kg: Math.round(co2Kg * 10) / 10,
          };
        });

        entries.sort((a, b) => b.points - a.points);
        setLeaders(entries);

        // Period stats
        let missionQuery = supabase.from('missions').select('id', { count: 'exact' }).eq('status', 'CLEANED');
        if (period === 'weekly') missionQuery = missionQuery.gte('updated_at', weekAgo);
        else if (period === 'monthly') missionQuery = missionQuery.gte('updated_at', monthAgo);
        const { count: missionCount } = await missionQuery;

        const totalWaste = entries.reduce((s, e) => s + e.waste_kg, 0);
        const totalCo2 = entries.reduce((s, e) => s + e.co2_kg, 0);
        setPeriodStats({
          total_missions: missionCount || 0,
          total_waste_kg: Math.round(totalWaste * 10) / 10,
          total_co2_kg: Math.round(totalCo2 * 10) / 10,
          total_items_cleaned: 0,
        });
      }
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

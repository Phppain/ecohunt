import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth-context';
import type { GeoPosition } from './use-geolocation';

export interface NearbyUser {
  id: string;
  user_id: string;
  username: string;
  avatar_url: string | null;
  lat: number;
  lng: number;
  is_cleaning: boolean;
  updated_at: string;
}

// Only broadcasts and fetches when real position is available
export function useNearbyUsers(myPosition: GeoPosition | null) {
  const { user } = useAuth();
  const [users, setUsers] = useState<NearbyUser[]>([]);
  const [cleaningCount, setCleaningCount] = useState(0);
  const mountedRef = useRef(true);
  const broadcastInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const fetchingRef = useRef(false);

  // Safe state setter — wraps in queueMicrotask for Safari compatibility
  const safeSetUsers = useCallback((val: NearbyUser[]) => {
    if (!mountedRef.current) return;
    try { setUsers(val); } catch { /* swallow */ }
  }, []);
  const safeSetCount = useCallback((val: number) => {
    if (!mountedRef.current) return;
    try { setCleaningCount(val); } catch { /* swallow */ }
  }, []);

  // Broadcast my location every 5 seconds (reduced from 3 for Safari)
  useEffect(() => {
    if (!user || !myPosition) return;

    let cancelled = false;
    const broadcast = async () => {
      if (cancelled) return;
      try {
        await supabase.from('user_locations').upsert(
          { user_id: user.id, lat: myPosition.lat, lng: myPosition.lng, is_cleaning: false, updated_at: new Date().toISOString() },
          { onConflict: 'user_id' }
        );
      } catch (e) {
        console.warn('Failed to broadcast location:', e);
      }
    };

    broadcast();
    broadcastInterval.current = setInterval(broadcast, 5000);
    return () => {
      cancelled = true;
      if (broadcastInterval.current) clearInterval(broadcastInterval.current);
    };
  }, [user, myPosition?.lat, myPosition?.lng]);

  const fetchUsers = useCallback(async () => {
    if (!user || !mountedRef.current || fetchingRef.current) return;
    fetchingRef.current = true;

    try {
      const { data: locations, error: locErr } = await supabase
        .from('user_locations')
        .select('*')
        .neq('user_id', user.id);

      if (locErr) throw locErr;
      if (!mountedRef.current) return;

      if (!locations || locations.length === 0) {
        safeSetUsers([]);
        safeSetCount(0);
        return;
      }

      const userIds = locations.map(l => l.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, username, avatar_url')
        .in('user_id', userIds);

      if (!mountedRef.current) return;

      const profileMap = new Map((profiles ?? []).map(p => [p.user_id, p]));

      const mapped: NearbyUser[] = locations.map((d) => {
        const profile = profileMap.get(d.user_id);
        return {
          id: d.id,
          user_id: d.user_id,
          username: profile?.username ?? 'User',
          avatar_url: profile?.avatar_url ?? null,
          lat: d.lat,
          lng: d.lng,
          is_cleaning: d.is_cleaning,
          updated_at: d.updated_at,
        };
      });
      safeSetUsers(mapped);
      safeSetCount(mapped.filter(u => u.is_cleaning).length);
    } catch (e) {
      console.warn('Failed to fetch nearby users:', e);
    } finally {
      fetchingRef.current = false;
    }
  }, [user, safeSetUsers, safeSetCount]);

  useEffect(() => {
    mountedRef.current = true;

    // Delay initial fetch slightly to ensure React's dispatcher is ready (Safari fix)
    const timer = setTimeout(() => {
      if (mountedRef.current) fetchUsers();
    }, 100);

    const channel = supabase
      .channel('user-locations-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_locations' }, () => {
        if (mountedRef.current) fetchUsers();
      })
      .subscribe();

    return () => {
      mountedRef.current = false;
      clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [fetchUsers]);

  return { nearbyUsers: users, cleaningCount };
}

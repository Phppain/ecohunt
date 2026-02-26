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

export function useNearbyUsers(myPosition: GeoPosition | null) {
  const { user } = useAuth();
  const [users, setUsers] = useState<NearbyUser[]>([]);
  const [cleaningCount, setCleaningCount] = useState(0);
  const broadcastInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  // Broadcast my location every 3 seconds
  useEffect(() => {
    if (!user || !myPosition) return;

    const broadcast = async () => {
      await supabase.from('user_locations').upsert(
        { user_id: user.id, lat: myPosition.lat, lng: myPosition.lng, is_cleaning: false, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      );
    };

    broadcast();
    broadcastInterval.current = setInterval(broadcast, 3000);
    return () => { if (broadcastInterval.current) clearInterval(broadcastInterval.current); };
  }, [user, myPosition?.lat, myPosition?.lng]);

  // Fetch nearby users + subscribe to realtime changes
  const fetchUsers = useCallback(async () => {
    if (!user) return;
    // Fetch locations
    const { data: locations } = await supabase
      .from('user_locations')
      .select('*')
      .neq('user_id', user.id);

    if (!locations || locations.length === 0) {
      setUsers([]);
      setCleaningCount(0);
      return;
    }

    // Fetch profiles for those users
    const userIds = locations.map(l => l.user_id);
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, username, avatar_url')
      .in('user_id', userIds);

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
    setUsers(mapped);
    setCleaningCount(mapped.filter(u => u.is_cleaning).length);
  }, [user]);

  useEffect(() => {
    fetchUsers();

    const channel = supabase
      .channel('user-locations-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_locations' }, () => {
        fetchUsers();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchUsers]);

  return { nearbyUsers: users, cleaningCount };
}

import { useState, useEffect, useCallback, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Leaf, Users, Filter, Layers, Trash2, MapPin, Navigation, Plus } from 'lucide-react';
import { EcoChip } from '@/components/eco/EcoChip';
import { EcoCard } from '@/components/eco/EcoCard';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { useGeolocation } from '@/hooks/use-geolocation';
import { useNearbyUsers } from '@/hooks/use-nearby-users';
import { useAuth } from '@/lib/auth-context';
import { toast } from 'sonner';

interface Zone {
  id: string;
  name: string;
  center_lat: number;
  center_lng: number;
  radius_m: number;
  severity: 'GREEN' | 'YELLOW' | 'RED';
}

interface Mission {
  id: string;
  lat: number;
  lng: number;
  title: string | null;
  status: string;
}

const severityColor: Record<string, string> = {
  GREEN: '#22c55e',
  YELLOW: '#eab308',
  RED: '#ef4444',
};

// Custom icons
const createUserIcon = (label: string, isSelf?: boolean) => L.divIcon({
  className: '',
  html: `<div style="width:36px;height:36px;border-radius:50%;background:${isSelf ? 'hsl(142,71%,45%)' : '#fff'};border:3px solid ${isSelf ? '#166534' : 'hsl(142,71%,45%)'};display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;color:${isSelf ? '#fff' : '#166534'};box-shadow:0 2px 8px rgba(0,0,0,0.2)">${label}</div>`,
  iconSize: [36, 36],
  iconAnchor: [18, 18],
});

const missionIcon = L.divIcon({
  className: '',
  html: `<div style="width:40px;height:40px;border-radius:12px;background:linear-gradient(135deg,hsl(142,71%,45%),hsl(85,60%,50%));display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(34,197,94,0.4)">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
  </div>`,
  iconSize: [40, 40],
  iconAnchor: [20, 20],
});

// Component to recenter map
function RecenterButton({ position }: { position: [number, number] }) {
  const map = useMap();
  return (
    <button
      onClick={() => map.flyTo(position, 15, { duration: 0.8 })}
      className="absolute bottom-28 right-4 z-[1000] w-10 h-10 rounded-xl bg-card eco-shadow-md flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
    >
      <Navigation className="w-4 h-4" />
    </button>
  );
}

// Component to handle map tap for creating missions
function MapClickHandler({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

// Component to set initial view
function SetViewOnLoad({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, 14);
  }, [center[0], center[1]]);
  return null;
}

export default function MapScreen() {
  const [zones, setZones] = useState<Zone[]>([]);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [tappedLocation, setTappedLocation] = useState<{ lat: number; lng: number } | null>(null);
  const navigate = useNavigate();
  const { user } = useAuth();

  const { position, permissionDenied, requestPermission } = useGeolocation({ enableHighAccuracy: true, distanceFilter: 5 });
  const { nearbyUsers, cleaningCount } = useNearbyUsers(position);

  const myCenter: [number, number] = useMemo(() => [position.lat, position.lng], [position.lat, position.lng]);

  // Fetch zones & missions
  useEffect(() => {
    const fetchData = async () => {
      const [zonesRes, missionsRes] = await Promise.all([
        supabase.from('zones').select('*'),
        supabase.from('missions').select('*').limit(50),
      ]);
      if (zonesRes.data) setZones(zonesRes.data as Zone[]);
      if (missionsRes.data) setMissions(missionsRes.data as Mission[]);
    };
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleMapClick = useCallback((lat: number, lng: number) => {
    setTappedLocation({ lat, lng });
  }, []);

  const handleCreateMission = useCallback(async () => {
    if (!tappedLocation || !user) return;
    const { error } = await supabase.from('missions').insert({
      lat: tappedLocation.lat,
      lng: tappedLocation.lng,
      creator_id: user.id,
      title: 'New cleanup mission',
    });
    if (error) {
      toast.error('Failed to create mission');
    } else {
      toast.success('Mission created!');
      setTappedLocation(null);
      // Refresh missions
      const { data } = await supabase.from('missions').select('*').limit(50);
      if (data) setMissions(data as Mission[]);
    }
  }, [tappedLocation, user]);

  const myIcon = useMemo(() => createUserIcon('Me', true), []);

  return (
    <div className="relative h-screen w-full overflow-hidden">
      {/* Permission denied overlay */}
      {permissionDenied && (
        <div className="absolute inset-0 z-[2000] bg-background/80 backdrop-blur-sm flex items-center justify-center p-6">
          <EcoCard variant="elevated" className="max-w-sm text-center p-6">
            <MapPin className="w-12 h-12 text-primary mx-auto mb-3" />
            <h3 className="text-lg font-bold text-foreground mb-2">Нужен доступ к геолокации</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Чтобы видеть карту и других пользователей рядом, разрешите доступ к местоположению.
            </p>
            <button onClick={requestPermission} className="eco-gradient text-primary-foreground px-6 py-2 rounded-xl font-semibold">
              Включить геолокацию
            </button>
          </EcoCard>
        </div>
      )}

      {/* Leaflet Map */}
      <MapContainer
        center={myCenter}
        zoom={14}
        className="h-full w-full z-0"
        zoomControl={false}
        attributionControl={false}
      >
        <SetViewOnLoad center={myCenter} />
        <TileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
        />
        {/* Semi-transparent labels overlay */}
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png"
          opacity={0.7}
        />

        <MapClickHandler onMapClick={handleMapClick} />

        {/* Zones as colored circles */}
        {zones.map(zone => (
          <Circle
            key={zone.id}
            center={[zone.center_lat, zone.center_lng]}
            radius={zone.radius_m}
            pathOptions={{
              color: severityColor[zone.severity],
              fillColor: severityColor[zone.severity],
              fillOpacity: 0.25,
              weight: 2,
              opacity: 0.6,
            }}
          >
            <Popup>
              <strong>{zone.name}</strong><br />
              Severity: {zone.severity}
            </Popup>
          </Circle>
        ))}

        {/* Missions */}
        {missions.map(mission => (
          <Marker key={mission.id} position={[mission.lat, mission.lng]} icon={missionIcon}>
            <Popup>
              <strong>{mission.title || 'Cleanup Mission'}</strong><br />
              Status: {mission.status}<br />
              <button
                className="mt-1 text-xs font-semibold text-primary underline"
                onClick={() => navigate('/scan')}
              >
                Start cleaning →
              </button>
            </Popup>
          </Marker>
        ))}

        {/* My position */}
        <Marker position={myCenter} icon={myIcon}>
          <Popup>Вы здесь</Popup>
        </Marker>

        {/* Nearby users */}
        {nearbyUsers.map(u => (
          <Marker
            key={u.user_id}
            position={[u.lat, u.lng]}
            icon={createUserIcon(u.username.charAt(0).toUpperCase())}
          >
            <Popup>
              <strong>{u.username}</strong><br />
              {u.is_cleaning ? '🧹 Cleaning now' : 'Online'}
            </Popup>
          </Marker>
        ))}

        {/* Tapped location marker */}
        {tappedLocation && (
          <Marker
            position={[tappedLocation.lat, tappedLocation.lng]}
            icon={L.divIcon({
              className: '',
              html: `<div style="width:24px;height:24px;border-radius:50%;background:hsl(142,71%,45%);border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3)"></div>`,
              iconSize: [24, 24],
              iconAnchor: [12, 12],
            })}
          >
            <Popup>
              <div className="text-center">
                <p className="text-xs text-muted-foreground mb-1">
                  {tappedLocation.lat.toFixed(5)}, {tappedLocation.lng.toFixed(5)}
                </p>
                <button
                  onClick={handleCreateMission}
                  className="text-xs font-bold text-primary underline"
                >
                  Create mission here
                </button>
              </div>
            </Popup>
          </Marker>
        )}
      </MapContainer>

      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 z-[1000] p-4 flex items-center justify-between pointer-events-none">
        <div className="pointer-events-auto flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl eco-gradient flex items-center justify-center">
              <Leaf className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-bold text-foreground text-lg drop-shadow-md">EcoHunt</span>
          </div>
          <EcoChip variant="green" className="animate-scale-in w-fit">
            <div className="w-2 h-2 rounded-full bg-eco-green animate-pulse" />
            <Users className="w-3.5 h-3.5" />
            {nearbyUsers.length + 1} users cleaning nearby
          </EcoChip>
        </div>

        {/* Right controls */}
        <div className="pointer-events-auto flex flex-col gap-2">
          <button
            onClick={() => toast.info('Filter coming soon')}
            className="w-10 h-10 rounded-xl bg-card/90 backdrop-blur eco-shadow-md flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          >
            <Filter className="w-4 h-4" />
          </button>
          <button
            onClick={() => toast.info('Layers coming soon')}
            className="w-10 h-10 rounded-xl bg-card/90 backdrop-blur eco-shadow-md flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          >
            <Layers className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Recenter button */}
      <RecenterButton position={myCenter} />

      {/* Bottom zone summary */}
      <div className="absolute bottom-20 left-4 right-4 z-[1000]">
        <EcoCard variant="glass" className="p-3">
          <div className="flex items-center gap-3">
            <MapPin className="w-5 h-5 text-primary" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground">{zones.length} Active Zones</p>
              <p className="text-xs text-muted-foreground">{missions.length} missions available</p>
            </div>
            <div className="flex gap-1.5">
              {(['GREEN', 'YELLOW', 'RED'] as const).map(s => (
                <div key={s} className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full" style={{ background: severityColor[s] }} />
                  <span className="text-xs text-muted-foreground">
                    {zones.filter(z => z.severity === s).length}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </EcoCard>
      </div>
    </div>
  );
}

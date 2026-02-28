import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.heat';
import { Users, MapPin, Navigation } from 'lucide-react';
import { EcoChip } from '@/components/eco/EcoChip';
import { EcoCard } from '@/components/eco/EcoCard';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { useGeolocation } from '@/hooks/use-geolocation';
import { useNearbyUsers } from '@/hooks/use-nearby-users';
import { useAuth } from '@/lib/auth-context';
import { toast } from 'sonner';
import { CityProgressCard } from '@/components/map/CityProgressCard';
import { reverseGeocode } from '@/lib/reverse-geocode';
import { MissionDetailCard } from '@/components/mission/MissionDetailCard';

interface Zone {
  id: string;
  name: string;
  center_lat: number;
  center_lng: number;
  radius_m: number;
  severity: 'GREEN' | 'YELLOW' | 'RED';
}

interface MissionAnalysis {
  items_before: number;
  items_after: number;
  difficulty: string;
  waste_diverted_kg: number;
  co2_saved_kg: number;
  improvement_pct: number;
}

interface Mission {
  id: string;
  lat: number;
  lng: number;
  title: string | null;
  status: string;
  zone_id: string | null;
  mission_analysis: MissionAnalysis[];
  is_help_request?: boolean;
  severity_color?: string;
  waste_category?: string;
  description?: string;
  volunteers_needed?: number;
  time_estimate?: string;
  tools_needed?: string[];
  cleanup_progress_pct?: number;
  before_photo_url?: string;
}

const problemDescriptions: Record<string, { icon: string; label: string; action: string }> = {
  HARD: { icon: '🏚️', label: 'Крупная свалка', action: 'Нужна бригада и спецтехника для вывоза' },
  MODERATE: { icon: '🗑️', label: 'Скопление мусора', action: 'Нужны волонтёры с мешками для уборки' },
  EASY: { icon: '📦', label: 'Разбросанный мусор', action: 'Можно убрать одному за 15-30 минут' },
};

const detailedProblems = [
  { icon: '🛢️', label: 'Слив отходов', detail: 'Обнаружены следы слива жидких отходов. Почва загрязнена, есть запах химикатов.', action: 'Вызвать экологическую инспекцию. Нужен отбор проб воды и почвы.' },
  { icon: '🗑️', label: 'Бытовой мусор', detail: 'Пакеты с бытовым мусором, пластиковые бутылки, упаковки от еды.', action: 'Собрать в мешки и вывезти. Понадобится 2-3 волонтёра на 1 час.' },
  { icon: '🚗', label: 'Автомобильные отходы', detail: 'Старые шины, канистры с маслом, автозапчасти. Возможно загрязнение почвы.', action: 'Нужен грузовой транспорт для вывоза. Шины сдать на переработку.' },
  { icon: '🏗️', label: 'Строительный мусор', detail: 'Обломки бетона, арматура, куски гипсокартона, строительная пыль.', action: 'Требуется контейнер для строймусора и спецтехника.' },
  { icon: '🌿', label: 'Заросли и завалы', detail: 'Территория завалена ветками, старой листвой. Возможно укрытие для грызунов.', action: 'Расчистить территорию. Нужны грабли, пилы, мешки для зелёных отходов.' },
  { icon: '🧴', label: 'Пластиковое загрязнение', detail: 'Большое количество пластика: бутылки, пакеты, одноразовая посуда.', action: 'Сортировка и сбор пластика. Сдать на переработку в ближайший пункт.' },
  { icon: '📱', label: 'Электронные отходы', detail: 'Выброшенная электроника: платы, провода, батарейки. Токсичные вещества!', action: 'Аккуратно собрать в отдельные контейнеры. Сдать в пункт утилизации э-отходов.' },
  { icon: '🍔', label: 'Пищевые отходы', detail: 'Гниющие пищевые отходы, привлекающие животных и насекомых.', action: 'Убрать и обработать территорию. Установить контейнер для органики.' },
  { icon: '🪵', label: 'Незаконная вырубка', detail: 'Свежие пни, спиленные деревья без разрешения. Нарушение экологии.', action: 'Сообщить в экологическую полицию. Зафиксировать GPS-координаты и фото.' },
  { icon: '💧', label: 'Загрязнение воды', detail: 'Мусор в водоёме/арыке. Пластик, бутылки, пятна нефтепродуктов на поверхности.', action: 'Организовать очистку береговой линии. Установить защитные сетки.' },
];

// Seeded random for consistent spot generation per zone
function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return s / 2147483647;
  };
}

function findNearestZone(lat: number, lng: number, zones: Zone[]): Zone | null {
  let nearest: Zone | null = null;
  let minDist = Infinity;
  for (const zone of zones) {
    const dist = Math.sqrt(
      Math.pow(lat - zone.center_lat, 2) + Math.pow(lng - zone.center_lng, 2)
    );
    const radiusDeg = zone.radius_m / 111000;
    if (dist < radiusDeg * 1.5 && dist < minDist) {
      minDist = dist;
      nearest = zone;
    }
  }
  return nearest;
}

const severityColor: Record<string, string> = {
  GREEN: '#22c55e',
  YELLOW: '#eab308',
  RED: '#ef4444',
};

function createUserDivIcon(label: string, isSelf?: boolean) {
  return L.divIcon({
    className: '',
    html: `<div style="width:36px;height:36px;border-radius:50%;background:${isSelf ? 'hsl(142,71%,45%)' : '#fff'};border:3px solid ${isSelf ? '#166534' : 'hsl(142,71%,45%)'};display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;color:${isSelf ? '#fff' : '#166534'};box-shadow:0 2px 8px rgba(0,0,0,0.2)">${label}</div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });
}

const missionDivIcon = L.divIcon({
  className: '',
  html: `<div style="width:40px;height:40px;border-radius:12px;background:linear-gradient(135deg,hsl(142,71%,45%),hsl(85,60%,50%));display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(34,197,94,0.4)">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
  </div>`,
  iconSize: [40, 40],
  iconAnchor: [20, 20],
});

export default function MapScreen() {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const myMarkerRef = useRef<L.Marker | null>(null);
  const userMarkersRef = useRef<Map<string, L.Marker>>(new Map());
  const missionMarkersRef = useRef<L.Marker[]>([]);
  const zoneCirclesRef = useRef<L.Circle[]>([]);
  const zoneLabelLayersRef = useRef<L.Marker[]>([]);
  const pollutionSpotsRef = useRef<L.LayerGroup | null>(null);
  const heatLayerRef = useRef<L.Layer | null>(null);
  const initializedRef = useRef(false);

  const [zones, setZones] = useState<Zone[]>([]);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [selectedMission, setSelectedMission] = useState<Mission | null>(null);
  const navigate = useNavigate();
  const { user } = useAuth();

  const { position, mapCenter, hasRealPosition, loading: geoLoading, permissionDenied, requestPermission, dismissPermission } = useGeolocation({ enableHighAccuracy: true, distanceFilter: 5 });
  const { nearbyUsers } = useNearbyUsers(position);

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || initializedRef.current) return;
    initializedRef.current = true;

    const map = L.map(mapContainerRef.current, {
      center: [mapCenter.lat, mapCenter.lng],
      zoom: 14,
      zoomControl: false,
      attributionControl: false,
    });

    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}').addTo(map);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png', { opacity: 0.7 }).addTo(map);

    // My marker — only add if we have real position
    if (hasRealPosition && position) {
      const myMarker = L.marker([position.lat, position.lng], { icon: createUserDivIcon('Me', true) }).addTo(map);
      myMarker.bindPopup('Вы здесь');
      myMarkerRef.current = myMarker;
    }

    // Click to create mission
    map.on('click', (e: L.LeafletMouseEvent) => {
      if (!user) return;
      const { lat, lng } = e.latlng;
      const popup = L.popup()
        .setLatLng(e.latlng)
        .setContent(`
          <div style="text-align:center;font-family:system-ui">
            <p style="font-size:11px;color:#666;margin:0 0 4px">${lat.toFixed(5)}, ${lng.toFixed(5)}</p>
            <button id="create-mission-btn" style="font-size:12px;font-weight:700;color:hsl(142,71%,45%);background:none;border:none;cursor:pointer;text-decoration:underline">Начать миссию здесь</button>
          </div>
        `)
        .openOn(map);

      setTimeout(() => {
        const btn = document.getElementById('create-mission-btn');
        if (btn) {
          btn.onclick = () => {
            map.closePopup();
            navigate('/mission-start', { state: { lat, lng } });
          };
        }
      }, 50);
    });

    // Pollution spots layer (always visible now — only real mission points)
    const spotsGroup = L.layerGroup().addTo(map);
    pollutionSpotsRef.current = spotsGroup;

    mapRef.current = map;

    return () => {
      map.remove();
      initializedRef.current = false;
    };
  }, []);

  // Update my position — only when real position exists
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !position) return;

    if (myMarkerRef.current) {
      myMarkerRef.current.setLatLng([position.lat, position.lng]);
    } else {
      // First real position arrived after map init — create marker and fly to it
      const myMarker = L.marker([position.lat, position.lng], { icon: createUserDivIcon('Me', true) }).addTo(map);
      myMarker.bindPopup('Вы здесь');
      myMarkerRef.current = myMarker;
      map.flyTo([position.lat, position.lng], 15, { duration: 1 });
    }
  }, [position?.lat, position?.lng]);

  // Update nearby user markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const currentIds = new Set(nearbyUsers.map(u => u.user_id));

    // Remove gone users
    userMarkersRef.current.forEach((marker, id) => {
      if (!currentIds.has(id)) {
        map.removeLayer(marker);
        userMarkersRef.current.delete(id);
      }
    });

    // Add/update users
    nearbyUsers.forEach(u => {
      const existing = userMarkersRef.current.get(u.user_id);
      if (existing) {
        existing.setLatLng([u.lat, u.lng]);
      } else {
        const marker = L.marker([u.lat, u.lng], {
          icon: createUserDivIcon(u.username.charAt(0).toUpperCase()),
        }).addTo(map);
        marker.bindPopup(`<strong>${u.username}</strong><br/>${u.is_cleaning ? '🧹 Cleaning' : 'Online'}`);
        userMarkersRef.current.set(u.user_id, marker);
      }
    });
  }, [nearbyUsers]);

  // Fetch & render zones & missions
  useEffect(() => {
    const fetchData = async () => {
      const [zonesRes, missionsRes] = await Promise.all([
        supabase.from('zones').select('*'),
        supabase.from('missions').select('*, mission_analysis(*)').limit(100),
      ]);
      if (zonesRes.data) setZones(zonesRes.data as Zone[]);
      if (missionsRes.data) setMissions(missionsRes.data as Mission[]);
    };
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, []);

  // Render zones + heatmap on map
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clear previous mission markers
    missionMarkersRef.current.forEach(m => map.removeLayer(m));
    missionMarkersRef.current = [];

    // Render only uncleaned missions as markers
    const processedMissionIds = new Set<string>();

    const addMissionMarker = (mission: Mission, color: string) => {
      if (mission.status === 'CLEANED') return;
      if (mission.lat === 0 && mission.lng === 0) return;

      const isHelp = mission.is_help_request;
      const markerColor = isHelp 
        ? (mission.severity_color === 'RED' ? '#ef4444' : '#f97316') 
        : color;
      const emoji = isHelp ? '🆘' : '⚠️';
      const size = isHelp ? 32 : 28;

      const icon = L.divIcon({
        className: '',
        html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${markerColor};display:flex;align-items:center;justify-content:center;box-shadow:0 0 0 4px ${markerColor}35, 0 0 12px ${markerColor}50;cursor:pointer;${isHelp ? 'animation:pulse 2s infinite;' : ''}">
          <span style="font-size:${size * 0.45}px">${emoji}</span>
        </div>`,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
      });

      const marker = L.marker([mission.lat, mission.lng], { icon }).addTo(map);
      marker.on('click', () => setSelectedMission(mission));
      missionMarkersRef.current.push(marker);
    };

    zones.forEach(zone => {
      const matchedMissions = missions.filter(m => {
        if (m.lat === 0 && m.lng === 0) return false;
        if (processedMissionIds.has(m.id)) return false;
        if (m.zone_id === zone.id) return true;
        if (!m.zone_id) return findNearestZone(m.lat, m.lng, zones)?.id === zone.id;
        return false;
      });

      matchedMissions.forEach(mission => {
        processedMissionIds.add(mission.id);
        addMissionMarker(mission, severityColor[zone.severity] || '#f97316');
      });
    });

    // Missions without a zone
    missions.forEach(mission => {
      if (processedMissionIds.has(mission.id)) return;
      processedMissionIds.add(mission.id);
      const color = mission.severity_color ? severityColor[mission.severity_color] || '#f97316' : '#f97316';
      addMissionMarker(mission, color);
    });
  }, [zones, missions]);

  const handleRecenter = useCallback(() => {
    if (position) {
      mapRef.current?.flyTo([position.lat, position.lng], 15, { duration: 0.8 });
    }
  }, [position?.lat, position?.lng]);

  return (
    <div className="relative h-screen w-full overflow-hidden">
      {permissionDenied && (
        <div className="absolute inset-0 z-[2000] bg-background/80 backdrop-blur-sm flex items-center justify-center p-6">
          <EcoCard variant="elevated" className="max-w-sm text-center p-6">
            <MapPin className="w-12 h-12 text-primary mx-auto mb-3" />
            <h3 className="text-lg font-bold text-foreground mb-2">Нужен доступ к геолокации</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Чтобы видеть карту и других пользователей рядом, разрешите доступ к местоположению.
            </p>
            <div className="flex flex-col gap-2">
              <button onClick={requestPermission} className="eco-gradient text-primary-foreground px-6 py-2 rounded-xl font-semibold">
                Включить геолокацию
              </button>
              <button onClick={dismissPermission} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Продолжить без геолокации
              </button>
            </div>
          </EcoCard>
        </div>
      )}

      {/* Map container */}
      <div ref={mapContainerRef} className="h-full w-full z-0" />

      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 z-[1000] p-4 pointer-events-none">
        <div className="pointer-events-auto w-fit">
          <EcoChip variant="green" className="animate-scale-in">
            <div className="w-2 h-2 rounded-full bg-eco-green animate-pulse" />
            <Users className="w-3.5 h-3.5" />
            {nearbyUsers.length + 1} users cleaning nearby
          </EcoChip>
        </div>
      </div>

      {/* Recenter button */}
      <button
        onClick={handleRecenter}
        className="absolute bottom-28 right-4 z-[1000] w-10 h-10 rounded-xl bg-card/90 backdrop-blur eco-shadow-md flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
      >
        <Navigation className="w-4 h-4" />
      </button>

      {/* Bottom progress card */}
      <div className="absolute bottom-20 left-4 right-4 z-[1000]">
        <CityProgressCard
          totalMissions={missions.filter(m => m.status !== 'CLEANED').length}
          cleanedMissions={missions.filter(m => m.status === 'CLEANED').length}
          zonesCount={zones.length}
          improvementPct={missions.length > 0 ? Math.round((missions.filter(m => m.status === 'CLEANED').length / missions.length) * 100) : 0}
        />
      </div>

      {/* Mission detail overlay */}
      {selectedMission && (
        <MissionDetailCard
          mission={selectedMission}
          onClose={() => setSelectedMission(null)}
          onJoined={() => {}}
        />
      )}
    </div>
  );
}

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
  const navigate = useNavigate();
  const { user } = useAuth();

  const { position, permissionDenied, requestPermission } = useGeolocation({ enableHighAccuracy: true, distanceFilter: 5 });
  const { nearbyUsers } = useNearbyUsers(position);

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || initializedRef.current) return;
    initializedRef.current = true;

    const map = L.map(mapContainerRef.current, {
      center: [position.lat, position.lng],
      zoom: 14,
      zoomControl: false,
      attributionControl: false,
    });

    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}').addTo(map);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png', { opacity: 0.7 }).addTo(map);

    // My marker
    const myMarker = L.marker([position.lat, position.lng], { icon: createUserDivIcon('Me', true) }).addTo(map);
    myMarker.bindPopup('Вы здесь');
    myMarkerRef.current = myMarker;

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

    // Pollution spots layer (visible only when zoomed in)
    const spotsGroup = L.layerGroup();
    pollutionSpotsRef.current = spotsGroup;

    const updateSpotsVisibility = () => {
      const zoom = map.getZoom();
      if (zoom >= 15) {
        if (!map.hasLayer(spotsGroup)) map.addLayer(spotsGroup);
      } else {
        if (map.hasLayer(spotsGroup)) map.removeLayer(spotsGroup);
      }
    };
    map.on('zoomend', updateSpotsVisibility);
    updateSpotsVisibility();

    mapRef.current = map;

    return () => {
      map.remove();
      initializedRef.current = false;
    };
  }, []);

  // Update my position
  useEffect(() => {
    if (myMarkerRef.current) {
      myMarkerRef.current.setLatLng([position.lat, position.lng]);
    }
  }, [position.lat, position.lng]);

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
        supabase.from('missions').select('*, mission_analysis(*)').limit(50),
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

    zoneCirclesRef.current.forEach(c => map.removeLayer(c));
    zoneCirclesRef.current = [];
    zoneLabelLayersRef.current.forEach(l => map.removeLayer(l));
    zoneLabelLayersRef.current = [];
    if (pollutionSpotsRef.current) pollutionSpotsRef.current.clearLayers();

    if (heatLayerRef.current) {
      map.removeLayer(heatLayerRef.current);
      heatLayerRef.current = null;
    }

    const severityIntensity: Record<string, number> = { GREEN: 0.25, YELLOW: 0.55, RED: 0.9 };
    const severityEmoji: Record<string, string> = { GREEN: '✅', YELLOW: '⚠️', RED: '🔴' };
    const heatPoints: [number, number, number][] = [];

    zones.forEach(zone => {
      // Calculate per-zone progress
      const zoneMissions = missions.filter(m => m.zone_id === zone.id);
      const cleaned = zoneMissions.filter(m => m.status === 'CLEANED').length;
      const total = zoneMissions.length;
      const pct = total > 0 ? Math.round((cleaned / total) * 100) : 0;

      const circle = L.circle([zone.center_lat, zone.center_lng], {
        radius: zone.radius_m,
        color: severityColor[zone.severity],
        fillColor: severityColor[zone.severity],
        fillOpacity: zone.severity === 'RED' ? 0.18 : zone.severity === 'YELLOW' ? 0.12 : 0.08,
        weight: 2,
        opacity: 0.6,
      }).addTo(map);

      const popupHtml = `
        <div style="font-family:system-ui;min-width:160px">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
            <span style="font-size:18px">${severityEmoji[zone.severity]}</span>
            <strong style="font-size:14px">${zone.name}</strong>
          </div>
          <div style="background:#f1f5f9;border-radius:8px;padding:8px;margin-bottom:6px">
            <div style="display:flex;justify-content:space-between;font-size:12px;color:#64748b;margin-bottom:4px">
              <span>Убрано</span>
              <span style="font-weight:700;color:${pct >= 70 ? '#16a34a' : pct >= 30 ? '#ca8a04' : '#dc2626'}">${pct}%</span>
            </div>
            <div style="height:6px;background:#e2e8f0;border-radius:3px;overflow:hidden">
              <div style="height:100%;width:${pct}%;background:linear-gradient(90deg,#22c55e,#16a34a);border-radius:3px"></div>
            </div>
            <div style="font-size:11px;color:#94a3b8;margin-top:3px">${cleaned} из ${total} миссий выполнено</div>
          </div>
          <div style="font-size:11px;color:#94a3b8">Осталось: <strong style="color:#334155">${total - cleaned}</strong></div>
        </div>
      `;
      circle.bindPopup(popupHtml);
      zoneCirclesRef.current.push(circle);


      // === Real mission spots ===
      const matchedMissions = missions.filter(m => {
        if (m.lat === 0 && m.lng === 0) return false;
        if (m.zone_id === zone.id) return true;
        if (!m.zone_id) return findNearestZone(m.lat, m.lng, zones)?.id === zone.id;
        return false;
      });

      matchedMissions.forEach(mission => {
        const analysis = mission.mission_analysis?.[0];
        const difficulty = analysis?.difficulty || 'MODERATE';
        const prob = problemDescriptions[difficulty] || problemDescriptions.MODERATE;
        const isCleaned = mission.status === 'CLEANED';
        const spotColor = isCleaned ? '#22c55e' : severityColor[zone.severity];

        const spot = L.circleMarker([mission.lat, mission.lng], {
          radius: isCleaned ? 8 : (difficulty === 'HARD' ? 16 : difficulty === 'MODERATE' ? 12 : 9),
          color: spotColor, fillColor: spotColor,
          fillOpacity: isCleaned ? 0.25 : 0.55,
          weight: isCleaned ? 1 : 2.5,
          opacity: isCleaned ? 0.4 : 0.8,
        });

        const popup = L.popup({ minWidth: 220 });
        spot.bindPopup(popup);
        spot.on('popupopen', async () => {
          popup.setContent('<div style="font-family:system-ui;text-align:center;padding:12px"><span style="color:#94a3b8">📍 Определяем адрес...</span></div>');
          const address = await reverseGeocode(mission.lat, mission.lng);
          const itemsBefore = analysis?.items_before ?? '—';
          const wasteDiverted = analysis?.waste_diverted_kg?.toFixed(1) ?? '—';

          popup.setContent(`
            <div style="font-family:system-ui;min-width:220px">
              <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px">
                <span style="font-size:22px">${isCleaned ? '✅' : prob.icon}</span>
                <div>
                  <strong style="font-size:13px;display:block">${isCleaned ? 'Убрано!' : prob.label}</strong>
                  <span style="font-size:11px;color:#64748b">📍 ${address}</span>
                </div>
              </div>
              <div style="background:#f1f5f9;border-radius:8px;padding:8px;margin-bottom:6px">
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:11px">
                  <div>Предметов: <strong>${itemsBefore}</strong></div>
                  <div>Вывезено: <strong>${wasteDiverted} кг</strong></div>
                </div>
              </div>
              ${!isCleaned ? `<div style="background:#fef3c7;border-radius:8px;padding:8px;font-size:11px"><strong style="color:#92400e">🛠 ${prob.action}</strong></div>` : `<div style="background:#dcfce7;border-radius:8px;padding:8px;font-size:11px;color:#166534">✨ Проблема решена!</div>`}
            </div>
          `);
        });

        if (pollutionSpotsRef.current) pollutionSpotsRef.current.addLayer(spot);
      });

      // === Generated zone spots with unique locations & descriptions ===
      const spotCount = Math.max(4, Math.ceil(zone.radius_m / 70));
      const rng = seededRandom(zone.center_lat * 1000000 + zone.center_lng * 1000);

      for (let i = 0; i < spotCount; i++) {
        const angle = rng() * 2 * Math.PI;
        const dist = rng() * 0.85;
        const spotLat = zone.center_lat + (dist * zone.radius_m / 111000) * Math.cos(angle);
        const spotLng = zone.center_lng + (dist * zone.radius_m / 111000) * Math.sin(angle) / Math.cos(zone.center_lat * Math.PI / 180);
        const isCleaned = rng() < (pct / 100);
        const problemIdx = Math.floor(rng() * detailedProblems.length);
        const problem = detailedProblems[problemIdx];
        const spotColor = isCleaned ? '#22c55e' : severityColor[zone.severity];
        const spotRadius = 6 + rng() * 10;

        const spot = L.circleMarker([spotLat, spotLng], {
          radius: spotRadius,
          color: spotColor, fillColor: spotColor,
          fillOpacity: isCleaned ? 0.2 : 0.5,
          weight: isCleaned ? 1 : 2,
          opacity: isCleaned ? 0.3 : 0.7,
        });

        const popup = L.popup({ minWidth: 220 });
        spot.bindPopup(popup);
        spot.on('popupopen', async () => {
          popup.setContent('<div style="font-family:system-ui;text-align:center;padding:12px"><span style="color:#94a3b8">📍 Определяем адрес...</span></div>');
          const address = await reverseGeocode(spotLat, spotLng);

          popup.setContent(`
            <div style="font-family:system-ui;min-width:220px">
              <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px">
                <span style="font-size:22px">${isCleaned ? '✅' : problem.icon}</span>
                <div>
                  <strong style="font-size:13px;display:block">${isCleaned ? 'Убрано!' : problem.label}</strong>
                  <span style="font-size:11px;color:#64748b">📍 ${address}</span>
                </div>
              </div>
              <div style="background:#f8fafc;border-radius:8px;padding:8px;margin-bottom:6px">
                <p style="font-size:11px;color:#475569;margin:0;line-height:1.4">${isCleaned ? 'Территория очищена волонтёрами. Мусор вывезен и утилизирован.' : problem.detail}</p>
              </div>
              ${!isCleaned ? `
                <div style="background:#fef3c7;border-radius:8px;padding:8px;font-size:11px">
                  <strong style="color:#92400e">🛠 Что нужно сделать:</strong>
                  <p style="color:#78350f;margin:4px 0 0;line-height:1.3">${problem.action}</p>
                </div>
              ` : `
                <div style="background:#dcfce7;border-radius:8px;padding:8px;font-size:11px;color:#166534">
                  ✨ Спасибо волонтёрам за чистый город!
                </div>
              `}
            </div>
          `);
        });

        if (pollutionSpotsRef.current) pollutionSpotsRef.current.addLayer(spot);
      }

      // Heatmap
      const intensity = severityIntensity[zone.severity] ?? 0.5;
      const adjustedIntensity = intensity * (1 - pct / 100 * 0.7);
      const numPoints = Math.ceil((zone.radius_m / 50) * (adjustedIntensity * 3));
      for (let i = 0; i < numPoints; i++) {
        const angle = Math.random() * 2 * Math.PI;
        const r = Math.random() * (zone.radius_m / 111000);
        const lat = zone.center_lat + r * Math.cos(angle);
        const lng = zone.center_lng + r * Math.sin(angle) / Math.cos(zone.center_lat * Math.PI / 180);
        heatPoints.push([lat, lng, adjustedIntensity]);
      }
    });

    missions.filter(m => m.status === 'CLEANED').forEach(m => {
      heatPoints.push([m.lat, m.lng, -0.3]);
    });

    missions.filter(m => m.status !== 'CLEANED').forEach(m => {
      if (m.lat !== 0 && m.lng !== 0) {
        heatPoints.push([m.lat, m.lng, 0.7]);
      }
    });

    if (heatPoints.length > 0) {
      const heat = L.heatLayer(
        heatPoints.filter(p => p[2] > 0),
        {
          radius: 30,
          blur: 20,
          maxZoom: 17,
          max: 1,
          minOpacity: 0.15,
          gradient: {
            0.1: '#10b981',
            0.3: '#fbbf24',
            0.5: '#f97316',
            0.7: '#ef4444',
            0.9: '#dc2626',
            1.0: '#991b1b',
          },
        }
      ).addTo(map);
      heatLayerRef.current = heat;
    }
  }, [zones, missions]);

  // Mission markers removed - spots handle visualization now

  const handleRecenter = useCallback(() => {
    mapRef.current?.flyTo([position.lat, position.lng], 15, { duration: 0.8 });
  }, [position.lat, position.lng]);

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
            <button onClick={requestPermission} className="eco-gradient text-primary-foreground px-6 py-2 rounded-xl font-semibold">
              Включить геолокацию
            </button>
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
          totalMissions={missions.length}
          cleanedMissions={missions.filter(m => m.status === 'CLEANED').length}
          zonesCount={zones.length}
          improvementPct={missions.length > 0 ? Math.round((missions.filter(m => m.status === 'CLEANED').length / missions.length) * 100) : 0}
        />
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { Leaf, Users, Filter, Layers, Trash2, MapPin } from 'lucide-react';
import { EcoChip } from '@/components/eco/EcoChip';
import { EcoCard } from '@/components/eco/EcoCard';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

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

const severityColors = {
  GREEN: 'bg-eco-green/20 border-eco-green',
  YELLOW: 'bg-eco-yellow/20 border-eco-yellow',
  RED: 'bg-eco-red/20 border-eco-red',
};

const severityDot = {
  GREEN: 'bg-eco-green',
  YELLOW: 'bg-eco-yellow',
  RED: 'bg-eco-red',
};

export default function MapScreen() {
  const [zones, setZones] = useState<Zone[]>([]);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [nearbyUsers] = useState(Math.floor(Math.random() * 8) + 2);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      const [zonesRes, missionsRes] = await Promise.all([
        supabase.from('zones').select('*'),
        supabase.from('missions').select('*').limit(20),
      ]);
      if (zonesRes.data) setZones(zonesRes.data as Zone[]);
      if (missionsRes.data) setMissions(missionsRes.data as Mission[]);
    };
    fetchData();
  }, []);

  return (
    <div className="relative h-screen bg-secondary overflow-hidden">
      {/* Map background placeholder */}
      <div className="absolute inset-0 bg-gradient-to-b from-secondary via-eco-green-light/30 to-secondary">
        {/* Simulated map grid */}
        <svg className="w-full h-full opacity-10" viewBox="0 0 100 100">
          {Array.from({ length: 20 }).map((_, i) => (
            <line key={`h${i}`} x1="0" y1={i * 5} x2="100" y2={i * 5} stroke="currentColor" strokeWidth="0.2" />
          ))}
          {Array.from({ length: 20 }).map((_, i) => (
            <line key={`v${i}`} x1={i * 5} y1="0" x2={i * 5} y2="100" stroke="currentColor" strokeWidth="0.2" />
          ))}
        </svg>

        {/* Zone circles */}
        {zones.map((zone, i) => {
          const positions = [
            { top: '20%', left: '30%' },
            { top: '35%', left: '60%' },
            { top: '50%', left: '25%' },
            { top: '15%', left: '70%' },
            { top: '60%', left: '55%' },
            { top: '45%', left: '40%' },
          ];
          const pos = positions[i % positions.length];
          const size = zone.radius_m / 2;
          return (
            <div
              key={zone.id}
              className={`absolute rounded-full border-2 animate-pulse-eco ${severityColors[zone.severity]}`}
              style={{
                top: pos.top,
                left: pos.left,
                width: `${Math.max(60, size)}px`,
                height: `${Math.max(60, size)}px`,
                transform: 'translate(-50%, -50%)',
              }}
            >
              <div className="absolute inset-0 flex items-center justify-center">
                <Trash2 className="w-4 h-4 text-muted-foreground" />
              </div>
            </div>
          );
        })}

        {/* Mission pins */}
        {missions.slice(0, 5).map((mission, i) => {
          const pinPositions = [
            { top: '25%', left: '45%' },
            { top: '40%', left: '35%' },
            { top: '55%', left: '65%' },
            { top: '30%', left: '20%' },
            { top: '65%', left: '45%' },
          ];
          const pos = pinPositions[i % pinPositions.length];
          return (
            <div
              key={mission.id}
              className="absolute animate-float cursor-pointer"
              style={{ top: pos.top, left: pos.left, transform: 'translate(-50%, -50%)' }}
              onClick={() => navigate('/scan')}
            >
              <div className="w-10 h-10 rounded-xl eco-gradient flex items-center justify-center eco-shadow">
                <Trash2 className="w-5 h-5 text-primary-foreground" />
              </div>
              <div className="w-3 h-3 eco-gradient rotate-45 mx-auto -mt-1.5" />
            </div>
          );
        })}

        {/* User avatars */}
        {[
          { top: '30%', left: '50%' },
          { top: '45%', left: '70%' },
          { top: '55%', left: '30%' },
        ].map((pos, i) => (
          <div
            key={i}
            className="absolute w-8 h-8 rounded-full bg-card border-2 border-primary flex items-center justify-center eco-shadow text-xs font-bold text-primary"
            style={{ ...pos, transform: 'translate(-50%, -50%)' }}
          >
            {String.fromCharCode(65 + i)}
          </div>
        ))}
      </div>

      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 z-10 p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl eco-gradient flex items-center justify-center">
            <Leaf className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="font-bold text-foreground text-lg">EcoHunt</span>
        </div>
        <EcoChip variant="green" className="animate-scale-in">
          <Users className="w-3.5 h-3.5" />
          {nearbyUsers} cleaning nearby
        </EcoChip>
      </div>

      {/* Right side controls */}
      <div className="absolute right-4 top-1/3 z-10 flex flex-col gap-2">
        <button className="w-10 h-10 rounded-xl bg-card eco-shadow-md flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
          <Filter className="w-4 h-4" />
        </button>
        <button className="w-10 h-10 rounded-xl bg-card eco-shadow-md flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
          <Layers className="w-4 h-4" />
        </button>
      </div>

      {/* Bottom zone summary */}
      <div className="absolute bottom-24 left-4 right-4 z-10">
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
                  <div className={`w-2 h-2 rounded-full ${severityDot[s]}`} />
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

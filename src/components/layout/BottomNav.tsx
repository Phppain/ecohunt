import { Map, Trophy, User, Plus } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const navItems = [
  { icon: Map, label: 'Map', path: '/' },
  { icon: null, label: 'Scan', path: '/mission-start' }, // FAB placeholder
  { icon: Trophy, label: 'Ranks', path: '/leaderboard' },
  { icon: User, label: 'Profile', path: '/profile' },
];

export function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();

  const handleFabClick = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => navigate('/mission-start', { state: { lat: pos.coords.latitude, lng: pos.coords.longitude } }),
        () => {
          toast.error('Включите геолокацию для создания миссии');
          navigate('/mission-start');
        },
        { enableHighAccuracy: true, timeout: 5000 }
      );
    } else {
      toast.error('Геолокация не поддерживается');
      navigate('/mission-start');
    }
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50">
      {/* FAB */}
      <div className="absolute -top-1 left-[37.5%] -translate-x-1/2 z-10">
        <button
          onClick={handleFabClick}
          className="w-14 h-14 rounded-full eco-gradient eco-shadow-lg flex items-center justify-center text-primary-foreground hover:scale-110 transition-transform active:scale-95"
        >
          <Plus className="w-7 h-7" strokeWidth={2.5} />
        </button>
      </div>

      {/* Nav bar */}
      <nav className="bg-card/95 backdrop-blur-xl border-t border-border px-4 pb-safe">
        <div className="flex items-center h-16">
          {navItems.map((item, i) => {
            if (!item.icon) {
              // Spacer for FAB
              return <div key={i} className="flex-1 flex items-center justify-center" />;
            }
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={cn(
                  'flex-1 flex flex-col items-center gap-0.5 py-1 rounded-xl transition-all',
                  isActive
                    ? 'text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Icon className={cn('w-5 h-5', isActive && 'animate-scale-in')} />
                <span className="text-[10px] font-semibold">{item.label}</span>
                {isActive && (
                  <div className="w-1 h-1 rounded-full bg-primary mt-0.5" />
                )}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

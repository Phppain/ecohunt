import { Outlet } from 'react-router-dom';
import { BottomNav } from './BottomNav';
import logo from '@/assets/logo.jpeg';

export function AppLayout() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 bg-background/90 backdrop-blur-md border-b border-border px-4 py-2 flex items-center gap-2">
        <img src={logo} alt="EcoHunt" className="w-9 h-9 rounded-full object-cover" />
        <span className="text-base font-bold text-foreground">EcoHunt</span>
      </header>
      <div className="pb-20">
        <Outlet />
      </div>
      <BottomNav />
    </div>
  );
}

import { useState, useEffect } from 'react';
import { Clock, Users, Wrench, MapPin, UserPlus, Loader2, AlertTriangle, Leaf } from 'lucide-react';
import { EcoCard } from '@/components/eco/EcoCard';
import { EcoChip } from '@/components/eco/EcoChip';
import { EcoButton } from '@/components/eco/EcoButton';
import { EcoProgress } from '@/components/eco/EcoProgress';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { toast } from 'sonner';
import { reverseGeocode } from '@/lib/reverse-geocode';

interface MissionDetailCardProps {
  mission: {
    id: string;
    title: string | null;
    waste_category?: string;
    severity_color?: string;
    description?: string;
    volunteers_needed?: number;
    time_estimate?: string;
    tools_needed?: string[];
    cleanup_progress_pct?: number;
    before_photo_url?: string;
    lat: number;
    lng: number;
    status: string;
    is_help_request?: boolean;
  };
  onClose: () => void;
  onJoined?: () => void;
}

const severityLabels: Record<string, { label: string; emoji: string; bg: string; text: string }> = {
  GREEN: { label: 'Низкий', emoji: '🟢', bg: 'bg-primary/10', text: 'text-primary' },
  YELLOW: { label: 'Средний', emoji: '🟡', bg: 'bg-yellow-500/10', text: 'text-yellow-600' },
  ORANGE: { label: 'Высокий', emoji: '🟠', bg: 'bg-orange-500/10', text: 'text-orange-600' },
  RED: { label: 'Критический', emoji: '🔴', bg: 'bg-destructive/10', text: 'text-destructive' },
};

const defaultDescriptions: Record<string, string> = {
  RED: 'Обнаружено серьёзное загрязнение территории. Требуется срочная уборка с привлечением нескольких волонтёров и специального оборудования.',
  ORANGE: 'Значительное скопление мусора. Рекомендуется организовать группу для уборки в ближайшее время.',
  YELLOW: 'Умеренное загрязнение территории. Можно справиться небольшой группой волонтёров.',
  GREEN: 'Небольшое количество мусора. Один волонтёр может убрать за короткое время.',
};

export function MissionDetailCard({ mission, onClose, onJoined }: MissionDetailCardProps) {
  const { user } = useAuth();
  const [joining, setJoining] = useState(false);
  const [participantCount, setParticipantCount] = useState(0);
  const [alreadyJoined, setAlreadyJoined] = useState(false);
  const [address, setAddress] = useState<string>('Определяем адрес...');

  useEffect(() => {
    reverseGeocode(mission.lat, mission.lng).then(setAddress);
  }, [mission.lat, mission.lng]);

  useEffect(() => {
    const fetchParticipants = async () => {
      const { count } = await supabase
        .from('mission_participants')
        .select('*', { count: 'exact', head: true })
        .eq('mission_id', mission.id);
      setParticipantCount(count || 0);

      if (user) {
        const { data } = await supabase
          .from('mission_participants')
          .select('id')
          .eq('mission_id', mission.id)
          .eq('user_id', user.id)
          .maybeSingle();
        setAlreadyJoined(!!data);
      }
    };
    fetchParticipants();
  }, [mission.id, user]);

  const handleJoin = async () => {
    if (!user) return;
    setJoining(true);
    try {
      const { error } = await supabase.from('mission_participants').insert({
        mission_id: mission.id,
        user_id: user.id,
      } as any);
      if (error) throw error;
      setAlreadyJoined(true);
      setParticipantCount(p => p + 1);
      toast.success('Вы присоединились к миссии!');
      onJoined?.();
    } catch (err: any) {
      toast.error(err.message || 'Ошибка');
    } finally {
      setJoining(false);
    }
  };

  const progressPct = mission.cleanup_progress_pct || 0;
  const remaining = Math.round(100 - progressPct);
  const severity = severityLabels[mission.severity_color || 'YELLOW'] || severityLabels.YELLOW;
  const desc = mission.description || defaultDescriptions[mission.severity_color || 'YELLOW'] || defaultDescriptions.YELLOW;

  return (
    <div className="fixed inset-0 z-[3000] bg-background/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-6">
      <div className="w-full max-w-md bg-card rounded-t-3xl sm:rounded-2xl overflow-y-auto max-h-[85vh] animate-slide-up">
        {/* Header */}
        <div className={`p-5 ${severity.bg}`}>
          <div className="flex items-center justify-between mb-3">
            <EcoChip variant={mission.severity_color === 'RED' ? 'red' : mission.severity_color === 'GREEN' ? 'green' : 'yellow'} size="md">
              {severity.emoji} {severity.label} уровень
            </EcoChip>
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-card flex items-center justify-center text-muted-foreground hover:text-foreground">✕</button>
          </div>
          <h3 className="text-lg font-bold text-foreground">{mission.waste_category || mission.title || 'Загрязнённая территория'}</h3>
          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
            <MapPin className="w-3 h-3" />
            {address}
          </p>
        </div>

        {/* Before photo */}
        {mission.before_photo_url && (
          <div className="px-5 pt-4">
            <div className="relative rounded-xl overflow-hidden border border-border">
              <img src={mission.before_photo_url} alt="До" className="w-full h-40 object-cover" />
              <EcoChip variant="red" size="sm" className="absolute top-2 left-2">ДО</EcoChip>
            </div>
          </div>
        )}

        <div className="p-5 space-y-4">
          {/* Severity indicator */}
          <EcoCard className="flex items-start gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${severity.bg}`}>
              <AlertTriangle className={`w-5 h-5 ${severity.text}`} />
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Уровень загрязнения</p>
              <p className={`text-sm font-bold ${severity.text}`}>{severity.emoji} {severity.label}</p>
            </div>
          </EcoCard>

          {/* Description */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase mb-2 flex items-center gap-1">
              <Leaf className="w-3.5 h-3.5" /> Описание проблемы
            </p>
            <p className="text-sm text-foreground leading-relaxed">{desc}</p>
          </div>

          {/* Progress */}
          {progressPct > 0 && (
            <EcoCard>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-muted-foreground">Прогресс очистки</span>
                <span className="text-sm font-bold text-primary">{progressPct}%</span>
              </div>
              <EcoProgress value={progressPct} variant="success" size="md" />
              <p className="text-xs text-muted-foreground mt-1">Осталось ещё {remaining}%</p>
            </EcoCard>
          )}

          {/* Info grid */}
          <div className="grid grid-cols-3 gap-2">
            <div className="flex flex-col items-center gap-1 p-3 rounded-xl bg-secondary">
              <Users className="w-4 h-4 text-primary" />
              <span className="text-xs text-muted-foreground">Нужно</span>
              <span className="text-sm font-bold text-foreground">{mission.volunteers_needed || '—'}</span>
            </div>
            <div className="flex flex-col items-center gap-1 p-3 rounded-xl bg-secondary">
              <Clock className="w-4 h-4 text-primary" />
              <span className="text-xs text-muted-foreground">Время</span>
              <span className="text-sm font-bold text-foreground">{mission.time_estimate || '—'}</span>
            </div>
            <div className="flex flex-col items-center gap-1 p-3 rounded-xl bg-secondary">
              <UserPlus className="w-4 h-4 text-primary" />
              <span className="text-xs text-muted-foreground">Участв.</span>
              <span className="text-sm font-bold text-foreground">{participantCount}</span>
            </div>
          </div>

          {/* Tools */}
          {mission.tools_needed && mission.tools_needed.length > 0 && (
            <EcoCard>
              <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase flex items-center gap-1">
                <Wrench className="w-3.5 h-3.5" /> Инструменты
              </p>
              <div className="flex flex-wrap gap-2">
                {mission.tools_needed.map((tool, i) => (
                  <EcoChip key={i} variant="outline" size="sm">{tool}</EcoChip>
                ))}
              </div>
            </EcoCard>
          )}

          {/* Join button */}
          {mission.status !== 'CLEANED' && (
            alreadyJoined ? (
              <EcoButton variant="outline" className="w-full" disabled>
                ✅ Вы уже участвуете
              </EcoButton>
            ) : (
              <EcoButton variant="primary" className="w-full" onClick={handleJoin} disabled={joining}>
                {joining ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                Принять участие
              </EcoButton>
            )
          )}
        </div>
      </div>
    </div>
  );
}

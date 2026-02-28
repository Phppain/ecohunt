import { useState, useRef } from 'react';
import { ArrowLeft, Camera, Upload, MapPin, Trash2, Play, Loader2, Sparkles, CheckCircle2, AlertTriangle, Leaf, Zap, HelpCircle } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { EcoCard } from '@/components/eco/EcoCard';
import { EcoChip } from '@/components/eco/EcoChip';
import { EcoButton } from '@/components/eco/EcoButton';
import { EcoProgress } from '@/components/eco/EcoProgress';
import { NeedHelpForm } from '@/components/mission/NeedHelpForm';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { toast } from 'sonner';

interface BeforeAnalysis {
  items: { label: string; count: number; points_per_item: number }[];
  total_items: number;
  total_points: number;
  severity: 'GREEN' | 'YELLOW' | 'RED';
  difficulty: 'EASY' | 'MODERATE' | 'HARD';
  co2_impact_kg: number;
  waste_weight_kg: number;
  cleanup_tips: string[];
  summary: string;
}

interface AfterAnalysis {
  items_before: number;
  items_after: number;
  improvement_pct: number;
  items_removed: { label: string; count: number; points_earned: number }[];
  total_points_earned: number;
  co2_saved_kg: number;
  waste_diverted_kg: number;
  status: 'CLEAN' | 'IMPROVED' | 'NEEDS_MORE';
  report: string;
}

type Step = 'before_photo' | 'before_analysis' | 'cleaning' | 'after_photo' | 'after_analysis' | 'results' | 'need_help';

export default function MissionStart() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { lat, lng } = (location.state as { lat: number; lng: number }) || { lat: 0, lng: 0 };

  const [step, setStep] = useState<Step>('before_photo');
  const [beforePhoto, setBeforePhoto] = useState<string | null>(null);
  const [afterPhoto, setAfterPhoto] = useState<string | null>(null);
  const [beforeAnalysis, setBeforeAnalysis] = useState<BeforeAnalysis | null>(null);
  const [afterAnalysis, setAfterAnalysis] = useState<AfterAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [missionId, setMissionId] = useState<string | null>(null);

  const beforeInputRef = useRef<HTMLInputElement>(null);
  const afterInputRef = useRef<HTMLInputElement>(null);

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleBeforePhoto = async (file: File) => {
    const base64 = await fileToBase64(file);
    setBeforePhoto(base64);
    setStep('before_analysis');
    setLoading(true);

    try {
      // Upload photo
      const ext = file.name.split('.').pop();
      const tempId = crypto.randomUUID();
      const path = `${tempId}/before_${Date.now()}.${ext}`;
      await supabase.storage.from('mission-images').upload(path, file, { contentType: file.type });

      // AI analysis
      const { data, error } = await supabase.functions.invoke('analyze-waste', {
        body: { imageBase64: base64, mode: 'before' },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setBeforeAnalysis(data.result);
      setStep('cleaning');

      // Create mission
      if (user) {
        const { data: mission, error: missionError } = await supabase
          .from('missions')
          .insert({ lat, lng, creator_id: user.id, title: 'AI Cleanup Mission', status: 'IN_PROGRESS' })
          .select()
          .single();
        if (mission) setMissionId(mission.id);
        if (missionError) console.error(missionError);
      }
    } catch (err: any) {
      toast.error(err.message || 'Ошибка анализа фото');
      setStep('before_photo');
    } finally {
      setLoading(false);
    }
  };

  const handleAfterPhoto = async (file: File) => {
    const base64 = await fileToBase64(file);
    setAfterPhoto(base64);
    setStep('after_analysis');
    setLoading(true);

    try {
      // Upload after photo
      if (missionId) {
        const ext = file.name.split('.').pop();
        const path = `${missionId}/after_${Date.now()}.${ext}`;
        await supabase.storage.from('mission-images').upload(path, file, { contentType: file.type });
      }

      // AI analysis
      const { data, error } = await supabase.functions.invoke('analyze-waste', {
        body: { imageBase64: base64, mode: 'after', beforeData: beforeAnalysis },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setAfterAnalysis(data.result);
      setStep('results');

      // Update mission status + severity
      if (missionId && beforeAnalysis) {
        await supabase.from('missions').update({
          status: 'CLEANED',
          severity_color: beforeAnalysis.severity,
        }).eq('id', missionId);

        // Save analysis to mission_analysis (single source of truth for waste/co2)
        const result = data.result;
        await supabase.from('mission_analysis').insert({
          mission_id: missionId,
          items_before: result.items_before || 0,
          items_after: result.items_after || 0,
          improvement_pct: result.improvement_pct || 0,
          waste_diverted_kg: result.waste_diverted_kg || 0,
          co2_saved_kg: result.co2_saved_kg || 0,
          difficulty: beforeAnalysis.difficulty || 'EASY',
        });
      }

      // Award points via points_log (single source of truth for points)
      if (user && data.result?.total_points_earned) {
        await supabase.from('points_log').insert({
          user_id: user.id,
          mission_id: missionId,
          points: data.result.total_points_earned,
          reason: 'AI cleanup verification',
        });

        // Increment user_stats (for profile display)
        const { data: currentStats } = await supabase
          .from('user_stats')
          .select('total_points, weekly_points, monthly_points')
          .eq('user_id', user.id)
          .single();

        if (currentStats) {
          await supabase.from('user_stats').update({
            total_points: (currentStats.total_points || 0) + data.result.total_points_earned,
            weekly_points: (currentStats.weekly_points || 0) + data.result.total_points_earned,
            monthly_points: (currentStats.monthly_points || 0) + data.result.total_points_earned,
            last_action_at: new Date().toISOString(),
          }).eq('user_id', user.id);
        }
      }
    } catch (err: any) {
      toast.error(err.message || 'Ошибка анализа');
      setStep('after_photo');
    } finally {
      setLoading(false);
    }
  };

  const severityColors = { GREEN: 'green', YELLOW: 'yellow', RED: 'red' } as const;
  const difficultyLabels = { EASY: 'Легко', MODERATE: 'Средне', HARD: 'Сложно' };

  return (
    <div className="min-h-screen bg-background pb-8">
      {/* Header */}
      <div className="p-4 flex items-center gap-3 border-b border-border">
        <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-xl bg-secondary flex items-center justify-center text-foreground">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-bold text-foreground">
          {step === 'results' ? 'Результаты' : step === 'cleaning' ? 'Уборка' : 'Новая миссия'}
        </h1>
      </div>

      <div className="px-4 pt-4 space-y-4 animate-slide-up">
        {/* Location */}
        <EcoCard className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <MapPin className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-foreground">Точка на карте</p>
            <p className="text-xs text-muted-foreground">{lat.toFixed(5)}, {lng.toFixed(5)}</p>
          </div>
        </EcoCard>

        {/* === STEP: Before Photo === */}
        {step === 'before_photo' && (
          <>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">📷 Сфотографируйте загрязнённую территорию</p>
            <button
              onClick={() => beforeInputRef.current?.click()}
              className="w-full h-56 rounded-2xl border-2 border-dashed border-primary/30 bg-primary/5 flex flex-col items-center justify-center gap-3 transition-colors hover:bg-primary/10"
            >
              <Camera className="w-10 h-10 text-primary/60" />
              <span className="text-sm font-medium text-primary/70">Нажмите чтобы сделать фото</span>
              <span className="text-xs text-muted-foreground">ИИ проанализирует мусор и оценит награду</span>
            </button>
            <input ref={beforeInputRef} type="file" accept="image/*" capture="environment" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleBeforePhoto(f); }}
            />
          </>
        )}

        {/* === STEP: Analyzing Before === */}
        {step === 'before_analysis' && (
          <div className="flex flex-col items-center gap-4 py-12">
            {beforePhoto && <img src={beforePhoto} alt="Before" className="w-full h-48 rounded-2xl object-cover border border-border" />}
            <Loader2 className="w-10 h-10 text-primary animate-spin" />
            <p className="text-sm font-semibold text-foreground">ИИ анализирует фото...</p>
            <p className="text-xs text-muted-foreground text-center">Определяем тип и количество мусора,<br/>рассчитываем награду за уборку</p>
          </div>
        )}

        {/* === STEP: Cleaning (show before analysis + tips) === */}
        {step === 'cleaning' && beforeAnalysis && (
          <>
            {/* Before photo */}
            {beforePhoto && (
              <div className="relative rounded-2xl overflow-hidden border border-border">
                <img src={beforePhoto} alt="Before" className="w-full h-40 object-cover" />
                <EcoChip variant="red" className="absolute top-2 left-2">ДО</EcoChip>
              </div>
            )}

            {/* AI Summary */}
            <EcoCard variant="elevated">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-5 h-5 text-primary" />
                <span className="text-sm font-bold text-foreground">Анализ ИИ</span>
                <EcoChip variant={severityColors[beforeAnalysis.severity]} size="sm">
                  {beforeAnalysis.severity}
                </EcoChip>
              </div>
              <p className="text-sm text-muted-foreground mb-3">{beforeAnalysis.summary}</p>

              {/* Items detected */}
              <div className="space-y-2 mb-3">
                {beforeAnalysis.items.map((item, i) => (
                  <div key={i} className="flex items-center justify-between py-1 border-b border-border last:border-0">
                    <div className="flex items-center gap-2">
                      <Leaf className="w-3.5 h-3.5 text-primary" />
                      <span className="text-sm text-foreground">{item.label}</span>
                      <span className="text-xs text-muted-foreground">×{item.count}</span>
                    </div>
                    <span className="text-xs font-semibold text-primary">+{item.count * item.points_per_item} EP</span>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Всего предметов:</span>
                <span className="font-bold text-foreground">{beforeAnalysis.total_items}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Сложность:</span>
                <span className="font-bold text-foreground">{difficultyLabels[beforeAnalysis.difficulty]}</span>
              </div>
            </EcoCard>

            {/* Reward card */}
            <EcoCard variant="gradient">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-primary-foreground/20 flex items-center justify-center">
                  <Zap className="w-6 h-6 text-primary-foreground" />
                </div>
                <div>
                  <p className="text-sm text-primary-foreground/80">Награда за уборку</p>
                  <p className="text-2xl font-bold text-primary-foreground">+{beforeAnalysis.total_points} EP</p>
                </div>
              </div>
            </EcoCard>

            {/* Cleanup tips */}
            <EcoCard>
              <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase">💡 Советы по уборке</p>
              <ul className="space-y-2">
                {beforeAnalysis.cleanup_tips.map((tip, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                    <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                    {tip}
                  </li>
                ))}
              </ul>
            </EcoCard>

            {/* Need Help button for YELLOW/RED severity */}
            {beforeAnalysis && (beforeAnalysis.severity === 'YELLOW' || beforeAnalysis.severity === 'RED') && (
              <EcoCard className="border border-eco-orange/30 bg-eco-orange/5">
                <div className="flex items-center gap-2 mb-2">
                  <HelpCircle className="w-5 h-5 text-eco-orange" />
                  <span className="text-sm font-bold text-foreground">Не можете убрать сами?</span>
                </div>
                <p className="text-xs text-muted-foreground mb-3">
                  При сильном загрязнении вы можете опубликовать миссию на карте, чтобы привлечь волонтёров.
                </p>
                <EcoButton variant="outline" className="w-full border-eco-orange text-eco-orange" onClick={() => setStep('need_help')}>
                  <HelpCircle className="w-4 h-4" /> Нужна помощь
                </EcoButton>
              </EcoCard>
            )}

            {/* After photo upload */}
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">📷 После уборки — загрузите фото</p>
            {afterPhoto ? (
              <div className="relative rounded-2xl overflow-hidden border border-border">
                <img src={afterPhoto} alt="After" className="w-full h-40 object-cover" />
                <button onClick={() => setAfterPhoto(null)}
                  className="absolute top-2 right-2 w-8 h-8 rounded-full bg-destructive/80 backdrop-blur flex items-center justify-center text-destructive-foreground">
                  <Trash2 className="w-4 h-4" />
                </button>
                <EcoChip variant="green" className="absolute top-2 left-2">ПОСЛЕ</EcoChip>
              </div>
            ) : (
              <button onClick={() => afterInputRef.current?.click()}
                className="w-full h-48 rounded-2xl border-2 border-dashed border-primary/30 bg-primary/5 flex flex-col items-center justify-center gap-2 transition-colors hover:bg-primary/10">
                <Upload className="w-8 h-8 text-primary/60" />
                <span className="text-sm font-medium text-primary/70">Загрузить фото после уборки</span>
              </button>
            )}
            <input ref={afterInputRef} type="file" accept="image/*" capture="environment" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleAfterPhoto(f); }}
            />
          </>
        )}

        {/* === STEP: Need Help Form === */}
        {step === 'need_help' && beforeAnalysis && missionId && (
          <NeedHelpForm
            beforeAnalysis={beforeAnalysis}
            beforePhoto={beforePhoto || ''}
            missionId={missionId}
            lat={lat}
            lng={lng}
            onPublished={() => navigate('/')}
          />
        )}

        {/* === STEP: Analyzing After === */}
        {step === 'after_analysis' && (
          <div className="flex flex-col items-center gap-4 py-12">
            <div className="flex gap-3 w-full">
              {beforePhoto && <img src={beforePhoto} alt="Before" className="flex-1 h-32 rounded-xl object-cover border border-border" />}
              {afterPhoto && <img src={afterPhoto} alt="After" className="flex-1 h-32 rounded-xl object-cover border border-border" />}
            </div>
            <Loader2 className="w-10 h-10 text-primary animate-spin" />
            <p className="text-sm font-semibold text-foreground">ИИ сравнивает фото...</p>
            <p className="text-xs text-muted-foreground text-center">Считаем убранные предметы<br/>и начисляем EcoPoints</p>
          </div>
        )}

        {/* === STEP: Results === */}
        {step === 'results' && afterAnalysis && (
          <>
            {/* Before / After comparison */}
            <div className="flex gap-3">
              {beforePhoto && (
                <div className="flex-1 relative rounded-xl overflow-hidden border border-border">
                  <img src={beforePhoto} alt="Before" className="w-full h-32 object-cover" />
                  <EcoChip variant="red" size="sm" className="absolute top-2 left-2">ДО</EcoChip>
                </div>
              )}
              {afterPhoto && (
                <div className="flex-1 relative rounded-xl overflow-hidden border border-border">
                  <img src={afterPhoto} alt="After" className="w-full h-32 object-cover" />
                  <EcoChip variant="green" size="sm" className="absolute top-2 left-2">ПОСЛЕ</EcoChip>
                </div>
              )}
            </div>

            {/* Stats */}
            <EcoCard variant="elevated">
              <div className="grid grid-cols-3 gap-3 text-center mb-3">
                <div>
                  <p className="text-xs text-muted-foreground">До</p>
                  <p className="text-lg font-bold text-foreground">{afterAnalysis.items_before}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">После</p>
                  <p className="text-lg font-bold text-foreground">{afterAnalysis.items_after}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Улучшение</p>
                  <p className="text-lg font-bold eco-gradient-text">{afterAnalysis.improvement_pct}%</p>
                </div>
              </div>
              <EcoProgress value={afterAnalysis.improvement_pct} variant="success" size="lg" />
              <div className="mt-2 flex justify-center">
                <EcoChip variant={afterAnalysis.status === 'CLEAN' ? 'green' : afterAnalysis.status === 'IMPROVED' ? 'yellow' : 'red'}>
                  {afterAnalysis.status === 'CLEAN' && <CheckCircle2 className="w-3.5 h-3.5" />}
                  {afterAnalysis.status === 'IMPROVED' && <AlertTriangle className="w-3.5 h-3.5" />}
                  {afterAnalysis.status === 'CLEAN' ? 'ЧИСТО' : afterAnalysis.status === 'IMPROVED' ? 'УЛУЧШЕНО' : 'НУЖНА ДОРАБОТКА'}
                </EcoChip>
              </div>
            </EcoCard>

            {/* Status card */}
            <EcoCard variant={afterAnalysis.status === 'CLEAN' ? 'gradient' : 'elevated'}>
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className={`w-5 h-5 ${afterAnalysis.status === 'CLEAN' ? 'text-primary-foreground' : 'text-primary'}`} />
                <span className={`text-sm font-bold ${afterAnalysis.status === 'CLEAN' ? 'text-primary-foreground' : 'text-foreground'}`}>
                  {afterAnalysis.status === 'CLEAN' ? 'Территория убрана!' : 'Отчёт об уборке'}
                </span>
              </div>
              <p className={`text-sm ${afterAnalysis.status === 'CLEAN' ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
                {afterAnalysis.report}
              </p>
            </EcoCard>

            {/* Points earned */}
            <EcoCard variant="gradient">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-primary-foreground/20 flex items-center justify-center">
                  <Zap className="w-6 h-6 text-primary-foreground" />
                </div>
                <div>
                  <p className="text-sm text-primary-foreground/80">Заработано</p>
                  <p className="text-2xl font-bold text-primary-foreground">+{afterAnalysis.total_points_earned} EcoPoints</p>
                </div>
              </div>
            </EcoCard>

            {/* Env impact */}
            <div className="grid grid-cols-2 gap-3">
              <EcoCard>
                <p className="text-xs text-muted-foreground mb-1">🌿 CO₂ спасено</p>
                <p className="text-lg font-bold text-foreground">{afterAnalysis.co2_saved_kg} кг</p>
              </EcoCard>
              <EcoCard>
                <p className="text-xs text-muted-foreground mb-1">♻️ Мусор убран</p>
                <p className="text-lg font-bold text-foreground">{afterAnalysis.waste_diverted_kg} кг</p>
              </EcoCard>
            </div>

            {/* Items removed report */}
            <EcoCard>
              <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase">📋 Что было убрано</p>
              <div className="space-y-2">
                {afterAnalysis.items_removed.map((item, i) => (
                  <div key={i} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                    <div className="flex items-center gap-2">
                      <Leaf className="w-4 h-4 text-primary" />
                      <span className="text-sm text-foreground">{item.label}</span>
                      <span className="text-xs text-muted-foreground">×{item.count}</span>
                    </div>
                    <EcoChip variant="green" size="sm">+{item.points_earned} EP</EcoChip>
                  </div>
                ))}
              </div>
            </EcoCard>

            <EcoButton className="w-full" onClick={() => navigate('/')}>
              Вернуться на карту
            </EcoButton>
          </>
        )}
      </div>
    </div>
  );
}

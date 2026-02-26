import { useState, useRef } from 'react';
import { ArrowLeft, Camera, Upload, MapPin, Trash2, Play, Image as ImageIcon } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { EcoCard } from '@/components/eco/EcoCard';
import { EcoChip } from '@/components/eco/EcoChip';
import { EcoButton } from '@/components/eco/EcoButton';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { toast } from 'sonner';

export default function MissionStart() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { lat, lng } = (location.state as { lat: number; lng: number }) || { lat: 0, lng: 0 };

  const [beforePhoto, setBeforePhoto] = useState<string | null>(null);
  const [beforeFile, setBeforeFile] = useState<File | null>(null);
  const [afterPhoto, setAfterPhoto] = useState<string | null>(null);
  const [afterFile, setAfterFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [missionCreated, setMissionCreated] = useState(false);
  const [missionId, setMissionId] = useState<string | null>(null);

  const beforeInputRef = useRef<HTMLInputElement>(null);
  const afterInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoSelect = (file: File, type: 'before' | 'after') => {
    const url = URL.createObjectURL(file);
    if (type === 'before') {
      setBeforePhoto(url);
      setBeforeFile(file);
    } else {
      setAfterPhoto(url);
      setAfterFile(file);
    }
  };

  const uploadPhoto = async (file: File, missionId: string, kind: 'BEFORE' | 'AFTER') => {
    const ext = file.name.split('.').pop();
    const path = `${missionId}/${kind.toLowerCase()}_${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('mission-images')
      .upload(path, file, { contentType: file.type });

    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage
      .from('mission-images')
      .getPublicUrl(path);

    const { error: mediaError } = await supabase.from('mission_media').insert({
      mission_id: missionId,
      image_url: urlData.publicUrl,
      kind,
    });

    if (mediaError) throw mediaError;
    return urlData.publicUrl;
  };

  const handleStartMission = async () => {
    if (!user || !beforeFile) return;
    setLoading(true);

    try {
      // Create mission
      const { data: mission, error: missionError } = await supabase
        .from('missions')
        .insert({ lat, lng, creator_id: user.id, title: 'Cleanup mission', status: 'IN_PROGRESS' })
        .select()
        .single();

      if (missionError || !mission) throw missionError || new Error('Failed to create mission');

      setMissionId(mission.id);

      // Upload before photo
      await uploadPhoto(beforeFile, mission.id, 'BEFORE');

      setMissionCreated(true);
      toast.success('Миссия начата! Сделайте уборку и загрузите фото "После"');
    } catch (err: any) {
      toast.error(err.message || 'Ошибка при создании миссии');
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteMission = async () => {
    if (!missionId || !afterFile) return;
    setLoading(true);

    try {
      await uploadPhoto(afterFile, missionId, 'AFTER');

      await supabase
        .from('missions')
        .update({ status: 'CLEANED' })
        .eq('id', missionId);

      toast.success('Миссия завершена! 🎉');
      navigate('/post-clean', { state: { missionId } });
    } catch (err: any) {
      toast.error(err.message || 'Ошибка при завершении миссии');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-8">
      {/* Header */}
      <div className="p-4 flex items-center gap-3 border-b border-border">
        <button
          onClick={() => navigate(-1)}
          className="w-9 h-9 rounded-xl bg-secondary flex items-center justify-center text-foreground"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-bold text-foreground">
          {missionCreated ? 'Миссия в процессе' : 'Новая миссия'}
        </h1>
      </div>

      <div className="px-4 pt-4 space-y-4 animate-slide-up">
        {/* Location info */}
        <EcoCard className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <MapPin className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-foreground">Точка на карте</p>
            <p className="text-xs text-muted-foreground">
              {lat.toFixed(5)}, {lng.toFixed(5)}
            </p>
          </div>
        </EcoCard>

        {/* Before photo */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
            📷 Фото ДО уборки
          </p>
          {beforePhoto ? (
            <div className="relative rounded-2xl overflow-hidden border border-border">
              <img src={beforePhoto} alt="Before" className="w-full h-48 object-cover" />
              {!missionCreated && (
                <button
                  onClick={() => { setBeforePhoto(null); setBeforeFile(null); }}
                  className="absolute top-2 right-2 w-8 h-8 rounded-full bg-destructive/80 backdrop-blur flex items-center justify-center text-destructive-foreground"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
              <EcoChip variant="green" className="absolute bottom-2 left-2">
                ✓ Загружено
              </EcoChip>
            </div>
          ) : (
            <button
              onClick={() => beforeInputRef.current?.click()}
              className="w-full h-48 rounded-2xl border-2 border-dashed border-primary/30 bg-primary/5 flex flex-col items-center justify-center gap-2 transition-colors hover:bg-primary/10"
            >
              <Camera className="w-8 h-8 text-primary/60" />
              <span className="text-sm font-medium text-primary/70">Сделать фото или выбрать</span>
            </button>
          )}
          <input
            ref={beforeInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handlePhotoSelect(file, 'before');
            }}
          />
        </div>

        {/* After photo - only shown after mission created */}
        {missionCreated && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
              📷 Фото ПОСЛЕ уборки
            </p>
            {afterPhoto ? (
              <div className="relative rounded-2xl overflow-hidden border border-border">
                <img src={afterPhoto} alt="After" className="w-full h-48 object-cover" />
                <button
                  onClick={() => { setAfterPhoto(null); setAfterFile(null); }}
                  className="absolute top-2 right-2 w-8 h-8 rounded-full bg-destructive/80 backdrop-blur flex items-center justify-center text-destructive-foreground"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <EcoChip variant="green" className="absolute bottom-2 left-2">
                  ✓ Загружено
                </EcoChip>
              </div>
            ) : (
              <button
                onClick={() => afterInputRef.current?.click()}
                className="w-full h-48 rounded-2xl border-2 border-dashed border-primary/30 bg-primary/5 flex flex-col items-center justify-center gap-2 transition-colors hover:bg-primary/10"
              >
                <Upload className="w-8 h-8 text-primary/60" />
                <span className="text-sm font-medium text-primary/70">Загрузить фото после уборки</span>
              </button>
            )}
            <input
              ref={afterInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handlePhotoSelect(file, 'after');
              }}
            />
          </div>
        )}

        {/* Action buttons */}
        {!missionCreated ? (
          <EcoButton
            className="w-full"
            variant="primary"
            disabled={!beforeFile || loading}
            onClick={handleStartMission}
          >
            {loading ? (
              <div className="w-5 h-5 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin" />
            ) : (
              <>
                <Play className="w-4 h-4" />
                Начать миссию
              </>
            )}
          </EcoButton>
        ) : (
          <EcoButton
            className="w-full"
            variant="primary"
            disabled={!afterFile || loading}
            onClick={handleCompleteMission}
          >
            {loading ? (
              <div className="w-5 h-5 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin" />
            ) : (
              <>
                <ImageIcon className="w-4 h-4" />
                Завершить миссию
              </>
            )}
          </EcoButton>
        )}
      </div>
    </div>
  );
}

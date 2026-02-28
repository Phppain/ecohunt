import { useState } from 'react';
import { Loader2, Sparkles, Check } from 'lucide-react';
import { EcoCard } from '@/components/eco/EcoCard';
import { EcoButton } from '@/components/eco/EcoButton';
import { EcoChip } from '@/components/eco/EcoChip';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const WASTE_CATEGORIES = [
  { id: 'plastic', label: 'Пластик', icon: '🧴' },
  { id: 'mixed', label: 'Смешанный мусор', icon: '🗑️' },
  { id: 'construction', label: 'Строительные отходы', icon: '🏗️' },
  { id: 'illegal_dump', label: 'Незаконная свалка', icon: '🚯' },
  { id: 'tires', label: 'Шины / Автоотходы', icon: '🛞' },
  { id: 'electronics', label: 'Электроника', icon: '📱' },
  { id: 'food', label: 'Пищевые отходы', icon: '🍔' },
  { id: 'chemicals', label: 'Химические отходы', icon: '🛢️' },
  { id: 'glass', label: 'Стекло', icon: '🍾' },
  { id: 'green_waste', label: 'Зелёные отходы', icon: '🌿' },
];

interface NeedHelpFormProps {
  beforeAnalysis: {
    items: { label: string; count: number; points_per_item: number }[];
    total_items: number;
    severity: string;
    difficulty: string;
    summary: string;
    co2_impact_kg: number;
    waste_weight_kg: number;
  };
  beforePhoto: string;
  missionId: string;
  lat: number;
  lng: number;
  onPublished: () => void;
}

export function NeedHelpForm({ beforeAnalysis, beforePhoto, missionId, lat, lng, onPublished }: NeedHelpFormProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [customCategory, setCustomCategory] = useState('');
  const [severityColor, setSeverityColor] = useState<'ORANGE' | 'RED'>('ORANGE');
  const [description, setDescription] = useState('');
  const [generatingAI, setGeneratingAI] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const actualCategory = selectedCategory === 'custom' ? customCategory : 
    WASTE_CATEGORIES.find(c => c.id === selectedCategory)?.label || '';

  const buildFallbackDescription = () => {
    const volunteersNeeded = severityColor === 'RED' ? 10 : 5;
    const timeEstimate = severityColor === 'RED' ? '3-5 часов' : '1-2 часа';
    const categoryLabel = actualCategory || 'Смешанный мусор';
    return `На участке обнаружено загрязнение категории «${categoryLabel}» (${beforeAnalysis.total_items} ед., уровень ${beforeAnalysis.severity}). Требуется командная уборка с сортировкой отходов и безопасным вывозом. Оценочно нужно ${volunteersNeeded} волонтёров, время работ — ${timeEstimate}.`;
  };

  const handleAIGenerate = async () => {
    setGeneratingAI(true);
    try {
      const response = await Promise.race([
        supabase.functions.invoke('analyze-waste', {
          body: {
            mode: 'help_description',
            beforeData: {
              ...beforeAnalysis,
              category: actualCategory,
              severity_color: severityColor,
              user_description: description,
            },
          },
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('AI_TIMEOUT')), 15000)
        ),
      ]) as { data?: any; error?: any };

      if (response?.error) throw response.error;
      if (response?.data?.error) throw new Error(response.data.error);
      const desc = response?.data?.result?.description || response?.data?.result?.report;
      if (desc) {
        setDescription(desc);
      } else {
        setDescription(buildFallbackDescription());
      }
    } catch (err: any) {
      setDescription((prev) => prev.trim() || buildFallbackDescription());
      toast.error(err?.message === 'AI_TIMEOUT' ? 'ИИ отвечает слишком долго, подставил черновик описания' : (err.message || 'Ошибка генерации описания'));
    } finally {
      setGeneratingAI(false);
    }
  };

  const handlePublish = async () => {
    if (!actualCategory) {
      toast.error('Выберите категорию мусора');
      return;
    }
    setPublishing(true);
    try {
      // First get AI estimates if description is empty
      let finalDescription = description;
      let volunteersNeeded = severityColor === 'RED' ? 10 : 5;
      let timeEstimate = severityColor === 'RED' ? '3-5 часов' : '1-2 часа';
      let toolsNeeded = ['Перчатки', 'Мешки для мусора'];

      if (severityColor === 'RED') {
        toolsNeeded.push('Лопаты', 'Транспорт для вывоза');
      }

      // Update mission with help request data
      const { error } = await supabase
        .from('missions')
        .update({
          is_help_request: true,
          waste_category: actualCategory,
          severity_color: severityColor,
          description: finalDescription || `${actualCategory} — требуется помощь волонтёров`,
          volunteers_needed: volunteersNeeded,
          time_estimate: timeEstimate,
          tools_needed: toolsNeeded,
          before_photo_url: beforePhoto.startsWith('data:') ? null : beforePhoto,
          status: 'OPEN',
        } as any)
        .eq('id', missionId);

      if (error) throw error;

      toast.success('Миссия опубликована на карте!');
      onPublished();
    } catch (err: any) {
      toast.error(err.message || 'Ошибка публикации');
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="space-y-4 animate-slide-up">
      {/* Category selection */}
      <EcoCard>
        <p className="text-xs font-semibold text-muted-foreground uppercase mb-3">🗂 Категория мусора</p>
        <div className="flex flex-wrap gap-2 mb-3">
          {WASTE_CATEGORIES.map(cat => (
            <button
              key={cat.id}
              onClick={() => { setSelectedCategory(cat.id); setCustomCategory(''); }}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all border ${
                selectedCategory === cat.id
                  ? 'bg-primary/10 border-primary text-primary'
                  : 'bg-secondary border-border text-foreground hover:bg-secondary/80'
              }`}
            >
              <span>{cat.icon}</span>
              <span>{cat.label}</span>
              {selectedCategory === cat.id && <Check className="w-3.5 h-3.5" />}
            </button>
          ))}
          <button
            onClick={() => setSelectedCategory('custom')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all border ${
              selectedCategory === 'custom'
                ? 'bg-primary/10 border-primary text-primary'
                : 'bg-secondary border-border text-foreground hover:bg-secondary/80'
            }`}
          >
            ✏️ Своя категория
          </button>
        </div>
        {selectedCategory === 'custom' && (
          <input
            type="text"
            placeholder="Введите категорию..."
            value={customCategory}
            onChange={e => setCustomCategory(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        )}
      </EcoCard>

      {/* Severity color */}
      <EcoCard>
        <p className="text-xs font-semibold text-muted-foreground uppercase mb-3">🎨 Уровень загрязнения</p>
        <div className="flex gap-3">
          <button
            onClick={() => setSeverityColor('ORANGE')}
            className={`flex-1 flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
              severityColor === 'ORANGE'
                ? 'border-eco-orange bg-eco-orange/10'
                : 'border-border bg-secondary'
            }`}
          >
            <div className="w-8 h-8 rounded-full bg-eco-orange" />
            <span className="text-sm font-semibold text-foreground">Оранжевый</span>
            <span className="text-xs text-muted-foreground text-center">Среднее загрязнение, нужна помощь</span>
          </button>
          <button
            onClick={() => setSeverityColor('RED')}
            className={`flex-1 flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
              severityColor === 'RED'
                ? 'border-destructive bg-destructive/10'
                : 'border-border bg-secondary'
            }`}
          >
            <div className="w-8 h-8 rounded-full bg-destructive" />
            <span className="text-sm font-semibold text-foreground">Красный</span>
            <span className="text-xs text-muted-foreground text-center">Критичное загрязнение, много работы</span>
          </button>
        </div>
      </EcoCard>

      {/* Description */}
      <EcoCard>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase">📝 Описание проблемы</p>
          <button
            onClick={handleAIGenerate}
            disabled={generatingAI}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/20 transition-colors disabled:opacity-50"
          >
            {generatingAI ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            ИИ напишет
          </button>
        </div>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Опишите ситуацию: что за мусор, сколько его, какая площадь..."
          rows={4}
          className="w-full px-3 py-2 rounded-xl border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
        />
      </EcoCard>

      {/* Publish */}
      <EcoButton
        variant="primary"
        className="w-full"
        onClick={handlePublish}
        disabled={publishing || !actualCategory}
      >
        {publishing ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
        Опубликовать на карте
      </EcoButton>
    </div>
  );
}

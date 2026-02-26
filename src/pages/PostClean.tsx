import { useMemo } from 'react';
import { ArrowLeft, CheckCircle2, Leaf, Zap, Trash2, Wind } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { EcoCard } from '@/components/eco/EcoCard';
import { EcoChip } from '@/components/eco/EcoChip';
import { EcoButton } from '@/components/eco/EcoButton';
import { EcoProgress } from '@/components/eco/EcoProgress';
import { runPostCleanAnalysis, runBeforeScan, type AnalysisResult, type ScanResult } from '@/lib/mock-detection';

export default function PostClean() {
  const navigate = useNavigate();
  const location = useLocation();
  const beforeScan = (location.state?.scanResult as ScanResult) || runBeforeScan();

  const analysis = useMemo<AnalysisResult>(
    () => runPostCleanAnalysis(beforeScan.detections),
    [beforeScan.detections]
  );

  const statusColor = analysis.improvementPct >= 80 ? 'green' : analysis.improvementPct >= 50 ? 'yellow' : 'red';
  const statusText = analysis.improvementPct >= 80 ? 'CLEAN' : analysis.improvementPct >= 50 ? 'IMPROVED' : 'NEEDS MORE';

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="p-4 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-xl bg-secondary flex items-center justify-center text-foreground">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-bold text-foreground">Post-Clean Analysis</h1>
      </div>

      <div className="px-4 space-y-4 animate-slide-up">
        {/* Before/After comparison */}
        <div className="flex gap-3">
          <div className="flex-1 rounded-xl bg-eco-red-light border border-eco-red/20 h-32 flex flex-col items-center justify-center">
            <Trash2 className="w-6 h-6 text-eco-red mb-1" />
            <p className="text-xs font-semibold text-eco-red">BEFORE</p>
            <p className="text-lg font-bold text-foreground">{analysis.itemsBefore} items</p>
          </div>
          <div className="flex-1 rounded-xl bg-eco-green-light border border-eco-green/20 h-32 flex flex-col items-center justify-center">
            <CheckCircle2 className="w-6 h-6 text-eco-green mb-1" />
            <p className="text-xs font-semibold text-eco-green">AFTER</p>
            <p className="text-lg font-bold text-foreground">{analysis.itemsAfter} items</p>
          </div>
        </div>

        {/* Improvement */}
        <EcoCard variant="elevated">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-foreground">Improvement</span>
            <span className="text-2xl font-bold eco-gradient-text">{analysis.improvementPct}%</span>
          </div>
          <EcoProgress value={analysis.improvementPct} variant="success" size="lg" />
          <div className="mt-3 flex items-center justify-center">
            <EcoChip variant={statusColor}>
              {statusText === 'CLEAN' && <CheckCircle2 className="w-3.5 h-3.5" />}
              {statusText}
            </EcoChip>
          </div>
        </EcoCard>

        {/* Environmental impact */}
        <div className="grid grid-cols-2 gap-3">
          <EcoCard>
            <div className="flex items-center gap-2 mb-1">
              <Wind className="w-4 h-4 text-eco-blue" />
              <span className="text-xs text-muted-foreground">CO₂ Saved</span>
            </div>
            <p className="text-lg font-bold text-foreground">{analysis.co2SavedKg} kg</p>
          </EcoCard>
          <EcoCard>
            <div className="flex items-center gap-2 mb-1">
              <Trash2 className="w-4 h-4 text-eco-orange" />
              <span className="text-xs text-muted-foreground">Waste Diverted</span>
            </div>
            <p className="text-lg font-bold text-foreground">{analysis.wasteDivertedKg} kg</p>
          </EcoCard>
        </div>

        {/* Points earned */}
        <EcoCard variant="gradient">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary-foreground/20 flex items-center justify-center">
              <Zap className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <p className="text-sm text-primary-foreground/80">Points Earned</p>
              <p className="text-2xl font-bold text-primary-foreground">+{analysis.earnedPoints} EP</p>
            </div>
          </div>
          <EcoProgress
            value={analysis.earnedPoints}
            max={200}
            variant="default"
            size="sm"
            className="mt-3 [&_div]:bg-primary-foreground/30 [&_div_div]:bg-primary-foreground"
          />
        </EcoCard>

        {/* Items removed list */}
        <EcoCard>
          <p className="text-xs font-semibold text-muted-foreground mb-3">ITEMS REMOVED</p>
          <div className="space-y-2">
            {analysis.itemsRemoved.map((item, i) => (
              <div key={i} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                <div className="flex items-center gap-2">
                  <Leaf className="w-4 h-4 text-primary" />
                  <span className="text-sm text-foreground">{item.label}</span>
                </div>
                <EcoChip variant="green" size="sm">×{item.count}</EcoChip>
              </div>
            ))}
          </div>
        </EcoCard>

        <EcoButton className="w-full" onClick={() => navigate('/')}>
          Back to Map
        </EcoButton>
      </div>
    </div>
  );
}

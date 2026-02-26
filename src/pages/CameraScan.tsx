import { useState, useMemo } from 'react';
import { ArrowLeft, HelpCircle, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { EcoCard } from '@/components/eco/EcoCard';
import { EcoChip } from '@/components/eco/EcoChip';
import { EcoButton } from '@/components/eco/EcoButton';
import { runBeforeScan, type ScanResult } from '@/lib/mock-detection';

const tabs = ['Object Classification', 'Severity', 'Impact'];

export default function CameraScan() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(0);
  const scanResult = useMemo<ScanResult>(() => runBeforeScan(), []);

  const severityChipVariant = scanResult.severity === 'GREEN' ? 'green' : scanResult.severity === 'YELLOW' ? 'yellow' : 'red';
  const difficultyChipVariant = scanResult.difficulty === 'EASY' ? 'green' : scanResult.difficulty === 'MODERATE' ? 'yellow' : 'red';

  // Group detections by label
  const grouped = scanResult.detections.reduce<Record<string, number>>((acc, d) => {
    acc[d.label] = (acc[d.label] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-foreground relative">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-20 p-4 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-xl bg-card/20 backdrop-blur flex items-center justify-center text-primary-foreground">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 flex bg-card/20 backdrop-blur rounded-xl p-0.5">
          {tabs.map((tab, i) => (
            <button
              key={tab}
              onClick={() => setActiveTab(i)}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                activeTab === i
                  ? 'bg-card text-foreground eco-shadow-md'
                  : 'text-primary-foreground/70'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Camera preview area with bounding boxes */}
      <div className="relative w-full h-[55vh] bg-gradient-to-b from-muted to-secondary overflow-hidden">
        {/* Fake camera image background */}
        <div className="absolute inset-0 bg-gradient-to-br from-eco-green-dark/30 via-secondary to-muted" />

        {/* Bounding boxes */}
        {scanResult.detections.slice(0, 8).map((det, i) => (
          <div
            key={i}
            className="absolute border-2 border-eco-green rounded-sm"
            style={{
              left: `${det.bbox_x * 100}%`,
              top: `${det.bbox_y * 100}%`,
              width: `${det.bbox_w * 100}%`,
              height: `${det.bbox_h * 100}%`,
            }}
          >
            <span className="absolute -top-5 left-0 bg-eco-green text-primary-foreground text-[10px] px-1.5 py-0.5 rounded font-semibold whitespace-nowrap">
              {det.label} ({Math.round(det.confidence * 100)}%)
            </span>
          </div>
        ))}
      </div>

      {/* Bottom card */}
      <div className="relative z-10 -mt-6">
        <EcoCard variant="elevated" className="mx-4 p-5 rounded-2xl animate-slide-up">
          {/* Severity header */}
          <div className="flex items-center justify-between mb-4">
            <EcoChip variant={severityChipVariant} size="md">
              {scanResult.severity === 'RED' ? '🔴' : scanResult.severity === 'YELLOW' ? '🟡' : '🟢'}{' '}
              {scanResult.severity === 'GREEN' ? 'LOW' : scanResult.severity === 'YELLOW' ? 'MEDIUM' : 'HIGH'} POLLUTION
            </EcoChip>
            <EcoChip variant={difficultyChipVariant} size="sm">
              {scanResult.difficulty}
            </EcoChip>
          </div>

          {/* Detected items */}
          <p className="text-xs font-semibold text-muted-foreground mb-2">DETECTED ITEMS</p>
          <div className="flex flex-wrap gap-2 mb-4">
            {Object.entries(grouped).map(([label, count]) => (
              <EcoChip key={label} variant="outline" size="sm">
                {label} × {count}
              </EcoChip>
            ))}
          </div>

          {/* Points and action */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-eco-yellow" />
              <span className="text-sm font-bold text-foreground">
                Earn ~{scanResult.suggestedPoints} EcoPoints
              </span>
            </div>
          </div>

          <div className="flex gap-3 mt-4">
            <EcoButton variant="outline" className="flex-1" onClick={() => {}}>
              <HelpCircle className="w-4 h-4" /> Request Help
            </EcoButton>
            <EcoButton
              variant="primary"
              className="flex-1"
              onClick={() => navigate('/post-clean', { state: { scanResult } })}
            >
              Start Cleanup
            </EcoButton>
          </div>
        </EcoCard>
      </div>
    </div>
  );
}

// Mock AI Detection Service
// Replace with real ML model integration later

const LABELS = [
  'Plastic Bottle',
  'Can',
  'Plastic Bag',
  'Glass',
  'Paper',
  'Cigarette',
];

// CO2 coefficients per item (kg)
const CO2_COEFFICIENTS: Record<string, number> = {
  'Plastic Bottle': 0.082,
  'Can': 0.042,
  'Plastic Bag': 0.033,
  'Glass': 0.06,
  'Paper': 0.025,
  'Cigarette': 0.014,
};

// Weight per item (kg)
const WEIGHT_COEFFICIENTS: Record<string, number> = {
  'Plastic Bottle': 0.025,
  'Can': 0.015,
  'Plastic Bag': 0.008,
  'Glass': 0.35,
  'Paper': 0.01,
  'Cigarette': 0.001,
};

export interface Detection {
  label: string;
  confidence: number;
  bbox_x: number;
  bbox_y: number;
  bbox_w: number;
  bbox_h: number;
}

export interface ScanResult {
  detections: Detection[];
  severity: 'GREEN' | 'YELLOW' | 'RED';
  difficulty: 'EASY' | 'MODERATE' | 'HARD';
  itemCount: number;
  suggestedPoints: number;
}

export interface AnalysisResult {
  itemsBefore: number;
  itemsAfter: number;
  improvementPct: number;
  co2SavedKg: number;
  wasteDivertedKg: number;
  difficulty: 'EASY' | 'MODERATE' | 'HARD';
  earnedPoints: number;
  itemsRemoved: { label: string; count: number }[];
}

function randomBetween(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

function randomInt(min: number, max: number) {
  return Math.floor(randomBetween(min, max + 1));
}

export function generateMockDetections(kind: 'BEFORE' | 'AFTER'): Detection[] {
  const count = kind === 'BEFORE' ? randomInt(8, 20) : randomInt(0, 3);
  const detections: Detection[] = [];

  for (let i = 0; i < count; i++) {
    detections.push({
      label: LABELS[randomInt(0, LABELS.length - 1)],
      confidence: parseFloat(randomBetween(0.7, 0.99).toFixed(2)),
      bbox_x: parseFloat(randomBetween(0.05, 0.7).toFixed(3)),
      bbox_y: parseFloat(randomBetween(0.05, 0.7).toFixed(3)),
      bbox_w: parseFloat(randomBetween(0.05, 0.25).toFixed(3)),
      bbox_h: parseFloat(randomBetween(0.05, 0.25).toFixed(3)),
    });
  }

  return detections;
}

function getSeverity(count: number): 'GREEN' | 'YELLOW' | 'RED' {
  if (count <= 3) return 'GREEN';
  if (count <= 10) return 'YELLOW';
  return 'RED';
}

function getDifficulty(count: number): 'EASY' | 'MODERATE' | 'HARD' {
  if (count <= 5) return 'EASY';
  if (count <= 12) return 'MODERATE';
  return 'HARD';
}

function getBasePoints(difficulty: 'EASY' | 'MODERATE' | 'HARD'): number {
  switch (difficulty) {
    case 'EASY': return 25;
    case 'MODERATE': return 50;
    case 'HARD': return 100;
  }
}

export function runBeforeScan(): ScanResult {
  const detections = generateMockDetections('BEFORE');
  const count = detections.length;
  const difficulty = getDifficulty(count);
  return {
    detections,
    severity: getSeverity(count),
    difficulty,
    itemCount: count,
    suggestedPoints: getBasePoints(difficulty),
  };
}

export function runPostCleanAnalysis(beforeDetections: Detection[]): AnalysisResult {
  const afterDetections = generateMockDetections('AFTER');
  const itemsBefore = beforeDetections.length;
  const itemsAfter = afterDetections.length;
  const improvementPct = itemsBefore > 0 ? ((itemsBefore - itemsAfter) / itemsBefore) * 100 : 100;

  // Count items removed by label
  const beforeCounts: Record<string, number> = {};
  beforeDetections.forEach(d => {
    beforeCounts[d.label] = (beforeCounts[d.label] || 0) + 1;
  });
  const afterCounts: Record<string, number> = {};
  afterDetections.forEach(d => {
    afterCounts[d.label] = (afterCounts[d.label] || 0) + 1;
  });

  const itemsRemoved = Object.entries(beforeCounts).map(([label, count]) => ({
    label,
    count: Math.max(0, count - (afterCounts[label] || 0)),
  })).filter(i => i.count > 0);

  // Calculate environmental impact
  let co2SavedKg = 0;
  let wasteDivertedKg = 0;
  itemsRemoved.forEach(({ label, count }) => {
    co2SavedKg += (CO2_COEFFICIENTS[label] || 0.03) * count;
    wasteDivertedKg += (WEIGHT_COEFFICIENTS[label] || 0.01) * count;
  });

  const difficulty = getDifficulty(itemsBefore);
  const basePoints = getBasePoints(difficulty);
  const bonusMultiplier = improvementPct / 100;
  const earnedPoints = Math.round(basePoints + basePoints * bonusMultiplier);

  return {
    itemsBefore,
    itemsAfter,
    improvementPct: parseFloat(improvementPct.toFixed(1)),
    co2SavedKg: parseFloat(co2SavedKg.toFixed(3)),
    wasteDivertedKg: parseFloat(wasteDivertedKg.toFixed(3)),
    difficulty,
    earnedPoints,
    itemsRemoved,
  };
}

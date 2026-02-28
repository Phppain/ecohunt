/**
 * Single Source of Truth for EcoHunt calculations.
 * All period ranges, conversions, and aggregation logic lives here.
 * No random values. No mocks. Only real data.
 */

/** Waste category definition with EP, weight and CO₂ per item */
export interface WasteCategory {
  code: string;
  ep: number;
  weight_kg: number;
  co2_kg: number;
}

export const WASTE_CATEGORIES: Record<string, WasteCategory> = {
  plastic_pet_1:   { code: 'plastic_pet_1',   ep: 1, weight_kg: 0.025, co2_kg: 0.082 },
  plastic_hdpe_2:  { code: 'plastic_hdpe_2',  ep: 2, weight_kg: 0.04,  co2_kg: 0.06  },
  plastic_pvc_3:   { code: 'plastic_pvc_3',   ep: 3, weight_kg: 0.05,  co2_kg: 0.08  },
  plastic_ldpe_4:  { code: 'plastic_ldpe_4',  ep: 2, weight_kg: 0.008, co2_kg: 0.033 },
  plastic_pp_5:    { code: 'plastic_pp_5',    ep: 2, weight_kg: 0.02,  co2_kg: 0.04  },
  plastic_ps_6:    { code: 'plastic_ps_6',    ep: 3, weight_kg: 0.01,  co2_kg: 0.06  },
  plastic_other_7: { code: 'plastic_other_7', ep: 3, weight_kg: 0.03,  co2_kg: 0.07  },
  plastic_bag:     { code: 'plastic_bag',     ep: 3, weight_kg: 0.008, co2_kg: 0.033 },
  paper_cardboard: { code: 'paper_cardboard', ep: 1, weight_kg: 0.01,  co2_kg: 0.025 },
  metal_waste:     { code: 'metal_waste',     ep: 4, weight_kg: 0.015, co2_kg: 0.042 },
  glass_waste:     { code: 'glass_waste',     ep: 4, weight_kg: 0.35,  co2_kg: 0.06  },
  food_waste:      { code: 'food_waste',      ep: 1, weight_kg: 0.05,  co2_kg: 0.01  },
  cigarette_waste: { code: 'cigarette_waste', ep: 5, weight_kg: 0.001, co2_kg: 0.014 },
  mixed_waste:     { code: 'mixed_waste',     ep: 3, weight_kg: 0.05,  co2_kg: 0.05  },
};

export type Period = 'daily' | 'weekly' | 'monthly' | 'all';

/**
 * Returns { from, to } ISO strings for a given period.
 * - daily: start of today → now
 * - weekly: 7 days ago → now
 * - monthly: 30 days ago → now
 * - all: null → now (no lower bound)
 */
export function getPeriodRange(period: Period): { from: string | null; to: string } {
  const now = new Date();
  const to = now.toISOString();

  switch (period) {
    case 'daily': {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      return { from: start.toISOString(), to };
    }
    case 'weekly': {
      const start = new Date(now.getTime() - 7 * 86400000);
      return { from: start.toISOString(), to };
    }
    case 'monthly': {
      const start = new Date(now.getTime() - 30 * 86400000);
      return { from: start.toISOString(), to };
    }
    case 'all':
      return { from: null, to };
  }
}

export interface UserAggregation {
  user_id: string;
  username: string;
  avatar_url: string | null;
  eco_points: number;
  trash_kg: number;
  co2_kg: number;
  missions_count: number;
  green_count: number;
  yellow_count: number;
  red_count: number;
  streak_days: number;
  level: number;
}

export interface GlobalStats {
  total_missions: number;
  total_eco_points: number;
  total_trash_kg: number;
  total_co2_kg: number;
}

/**
 * Aggregate global stats from user aggregations.
 * This guarantees cards match the sum of leaderboard entries.
 */
export function aggregateGlobalStats(users: UserAggregation[]): GlobalStats {
  return users.reduce(
    (acc, u) => ({
      total_missions: acc.total_missions + u.missions_count,
      total_eco_points: acc.total_eco_points + u.eco_points,
      total_trash_kg: Math.round((acc.total_trash_kg + u.trash_kg) * 10) / 10,
      total_co2_kg: Math.round((acc.total_co2_kg + u.co2_kg) * 10) / 10,
    }),
    { total_missions: 0, total_eco_points: 0, total_trash_kg: 0, total_co2_kg: 0 }
  );
}

/**
 * Sort leaderboard entries with stable tie-breaking.
 * Primary: eco_points DESC
 * Secondary: trash_kg DESC
 * Tertiary: missions_count DESC
 * Quaternary: user_id ASC (stable)
 */
export function sortLeaderboard(entries: UserAggregation[]): UserAggregation[] {
  return [...entries].sort((a, b) => {
    if (b.eco_points !== a.eco_points) return b.eco_points - a.eco_points;
    if (b.trash_kg !== a.trash_kg) return b.trash_kg - a.trash_kg;
    if (b.missions_count !== a.missions_count) return b.missions_count - a.missions_count;
    return a.user_id.localeCompare(b.user_id);
  });
}

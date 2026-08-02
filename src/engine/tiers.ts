import tiersJson from '../data/tiers.json';
import type { TierConfig } from './types';

export const TIERS: TierConfig[] = tiersJson.tiers as TierConfig[];

export function getTier(id: number): TierConfig {
  const tier = TIERS.find((t) => t.id === id);
  if (!tier) throw new Error(`Unknown tier id: ${id}`);
  return tier;
}

/** Expected value of a set of values. */
export function expectedValue(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

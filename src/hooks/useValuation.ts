import { useEffect, useMemo, useState } from 'react';
import { discogsService, type DiscogsPriceStats, type DiscogsSearchResponse } from '@/services/discogs-service';

type ConditionGrade = 'Mint' | 'NM' | 'EX' | 'VG+' | 'VG' | 'G+' | 'G' | 'Fair' | 'Poor';

const CONDITION_MULTIPLIER: Record<ConditionGrade, number> = {
  Mint: 1,
  NM: 0.9,
  EX: 0.8,
  'VG+': 0.65,
  VG: 0.5,
  'G+': 0.35,
  G: 0.25,
  Fair: 0.15,
  Poor: 0.1,
};

export interface ValuationInput {
  /** Preferred Discogs release ID. Faster and more reliable than catalog number search. */
  releaseId?: number;
  /** Optional catalog number fallback when a release ID is unknown. */
  catalogNumber?: string;
  /** Whether this is a first press (applies a modest rarity premium). */
  isFirstPress?: boolean;
}

export interface ValuationResult {
  estimatedValue: number;
  range: { low: number; high: number };
  confidence: number;
  currency: string;
  sampleSize: number;
  source: 'discogs' | 'none';
}

export function useValuation(
  input: ValuationInput | null | undefined,
  condition: ConditionGrade = 'VG+',
) {
  const [valuation, setValuation] = useState<ValuationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const conditionFactor = useMemo(
    () => CONDITION_MULTIPLIER[condition] ?? CONDITION_MULTIPLIER['VG+'],
    [condition],
  );

  useEffect(() => {
    let cancelled = false;

    async function resolveReleaseId(): Promise<number | null> {
      if (input?.releaseId) return input.releaseId;
      if (!input?.catalogNumber) return null;

      try {
        const res: DiscogsSearchResponse = await discogsService.searchDatabase({
          catno: input.catalogNumber,
          type: 'release',
          per_page: 1,
        });
        return res.results[0]?.id ?? null;
      } catch {
        return null;
      }
    }

    async function loadValuation() {
      setLoading(true);
      setError(null);

      try {
        const releaseId = await resolveReleaseId();

        if (!releaseId) {
          if (!cancelled) {
            setValuation(null);
          }
          return;
        }

        const stats: DiscogsPriceStats = await discogsService.getReleasePriceStats(releaseId);
        const base = stats.medianPrice ?? stats.lowestPrice ?? 0;

        const rarityFactor = input?.isFirstPress ? 1.25 : 1;
        const estimated = Math.max(0, Math.round(base * conditionFactor * rarityFactor));

        const computed: ValuationResult = {
          estimatedValue: estimated,
          range: {
            low: Math.round(estimated * 0.75),
            high: Math.round(estimated * 1.35),
          },
          confidence: stats.medianPrice ? 0.85 : 0.45,
          currency: stats.currency,
          sampleSize: stats.numForSale,
          source: 'discogs',
        };

        if (!cancelled) {
          setValuation(computed);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error('Failed to calculate valuation'));
          setValuation(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadValuation();

    return () => {
      cancelled = true;
    };
  }, [input?.releaseId, input?.catalogNumber, input?.isFirstPress, conditionFactor]);

  return { valuation, loading, error };
}

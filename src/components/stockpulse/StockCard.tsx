import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { ChevronRight, TrendingUp, TrendingDown, Shield } from 'lucide-react-native';
import Card from '../ui/Card';
import ScoreRing from './ScoreRing';
import ConvictionBadge from './ConvictionBadge';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing, borderRadius } from '../../theme/spacing';

interface StockCardProps {
  ticker: string;
  companyName: string;
  sector: string;
  /** null when the stock is in the index but has never been analyzed. */
  score: number | null;
  conviction: string | null;
  price: number;
  marginOfSafety: number | null;
  changePct?: number | null;
  /** 'lite' means the score was built without FMP enrichment or an LLM thesis. */
  tier?: 'deep' | 'lite' | null;
  scoredAt?: string | null;
  onPress: () => void;
}

/**
 * How current an analysis is.
 *
 * Worth showing because a score can be months old: the index holds far more stocks than the daily
 * data budget can re-score, so age is the difference between a verdict and a memory. A stale score
 * used to render identically to one from an hour ago.
 */
function freshness(score: number | null, tier: StockCardProps['tier'], scoredAt: string | null | undefined) {
  if (score == null || !scoredAt) return null;
  if (tier === 'lite') return { label: 'Partial', bg: colors.warning[50], fg: colors.warning[700] };
  const days = (Date.now() - new Date(scoredAt).getTime()) / 86400000;
  if (days <= 3) return { label: 'Fresh', bg: colors.primary[50], fg: colors.primary[700] };
  if (days <= 14) return { label: `${Math.round(days)}d`, bg: colors.slate[100], fg: colors.slate[500] };
  return { label: `Stale ${Math.round(days)}d`, bg: colors.error[50], fg: colors.error[700] };
}

export default function StockCard({
  ticker,
  companyName,
  sector,
  score,
  conviction,
  price,
  marginOfSafety,
  changePct,
  tier,
  scoredAt,
  onPress,
}: StockCardProps) {
  const isUndervalued = marginOfSafety != null && marginOfSafety > 0;
  // Most of the index carries no CIRA score — it is browsable long before it is analyzed.
  const analyzed = score != null;
  const age = freshness(score, tier, scoredAt);

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <Card>
        <View style={styles.row}>
          {analyzed ? (
            <ScoreRing score={score} />
          ) : (
            // Deliberately not a zero-score ring: no score is not a bad score.
            <View style={styles.unscoredRing}>
              <Text style={styles.unscoredDash}>—</Text>
            </View>
          )}
          <View style={styles.info}>
            <View style={styles.nameRow}>
              <Text style={styles.ticker}>{ticker}</Text>
              {conviction ? (
                <ConvictionBadge conviction={conviction} />
              ) : (
                <View style={styles.unanalyzedBadge}>
                  <Text style={styles.unanalyzedText}>Not yet analyzed</Text>
                </View>
              )}
            </View>
            <Text style={styles.companyName} numberOfLines={1}>{companyName}</Text>
            <View style={styles.metaRow}>
              <Text style={styles.sector}>{sector}</Text>
              <Text style={styles.price}>${price.toFixed(2)}</Text>
              {changePct != null && (
                <Text style={[styles.changePct, { color: changePct >= 0 ? colors.primary[700] : colors.error[700] }]}>
                  {changePct >= 0 ? '+' : ''}{changePct.toFixed(2)}%
                </Text>
              )}
              {age && (
                <View style={[styles.freshnessBadge, { backgroundColor: age.bg }]}>
                  <Text style={[styles.freshnessText, { color: age.fg }]}>{age.label}</Text>
                </View>
              )}
              {marginOfSafety != null && (
                <View style={[
                  styles.mosBadge,
                  { backgroundColor: isUndervalued ? colors.primary[50] : colors.error[50] },
                ]}>
                  {isUndervalued ? (
                    <TrendingUp size={10} color={colors.primary[700]} strokeWidth={2} />
                  ) : (
                    <TrendingDown size={10} color={colors.error[700]} strokeWidth={2} />
                  )}
                  <Text style={[
                    styles.mosText,
                    { color: isUndervalued ? colors.primary[700] : colors.error[700] },
                  ]}>
                    {Math.abs(marginOfSafety).toFixed(0)}%
                  </Text>
                </View>
              )}
            </View>
          </View>
          <ChevronRight size={18} color={colors.slate[400]} strokeWidth={1.8} />
        </View>
      </Card>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  info: {
    flex: 1,
    minWidth: 0,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  ticker: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.slate[900],
  },
  companyName: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[500],
    marginTop: 2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: 4,
  },
  sector: {
    fontSize: typography.fontSize.xs,
    color: colors.slate[400],
  },
  price: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: colors.slate[700],
  },
  mosBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: borderRadius.sm,
  },
  mosText: {
    fontSize: 10,
    fontWeight: typography.fontWeight.semibold,
  },
  changePct: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
  },
  freshnessBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: borderRadius.sm,
  },
  freshnessText: {
    fontSize: 10,
    fontWeight: typography.fontWeight.semibold,
  },
  // Matches ScoreRing's footprint so unanalyzed rows line up with analyzed ones.
  unscoredRing: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 3,
    borderColor: colors.slate[200],
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  unscoredDash: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[400],
  },
  unanalyzedBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.slate[100],
  },
  unanalyzedText: {
    fontSize: 10,
    fontWeight: typography.fontWeight.semibold,
    color: colors.slate[500],
  },
});

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
  score: number;
  conviction: string;
  price: number;
  marginOfSafety: number | null;
  onPress: () => void;
}

export default function StockCard({
  ticker,
  companyName,
  sector,
  score,
  conviction,
  price,
  marginOfSafety,
  onPress,
}: StockCardProps) {
  const isUndervalued = marginOfSafety != null && marginOfSafety > 0;
  const isOvervalued = marginOfSafety != null && marginOfSafety < 0;

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <Card>
        <View style={styles.row}>
          <ScoreRing score={score} />
          <View style={styles.info}>
            <View style={styles.nameRow}>
              <Text style={styles.ticker}>{ticker}</Text>
              <ConvictionBadge conviction={conviction} />
            </View>
            <Text style={styles.companyName} numberOfLines={1}>{companyName}</Text>
            <View style={styles.metaRow}>
              <Text style={styles.sector}>{sector}</Text>
              <Text style={styles.price}>${price.toFixed(2)}</Text>
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
});

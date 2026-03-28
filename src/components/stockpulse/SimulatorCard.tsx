import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { TrendingUp, TrendingDown, X } from 'lucide-react-native';
import Card from '../ui/Card';
import ConvictionBadge from './ConvictionBadge';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing, borderRadius } from '../../theme/spacing';
import type { SimulatorPick } from '../../lib/stockpulseApi';

interface SimulatorCardProps {
  pick: SimulatorPick;
  onClose: () => void;
  onPress: () => void;
  closing?: boolean;
}

export default function SimulatorCard({ pick, onClose, onPress, closing }: SimulatorCardProps) {
  const isPositive = pick.pnl_dollars >= 0;
  const pnlColor = isPositive ? colors.primary[600] : colors.error[600];
  const PnlIcon = isPositive ? TrendingUp : TrendingDown;

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <Card>
        <View style={styles.row}>
          {/* Score + Ticker */}
          <View style={styles.left}>
            <View style={styles.tickerRow}>
              <Text style={styles.ticker}>{pick.ticker}</Text>
              <ConvictionBadge conviction={pick.current_ai_conviction || pick.ai_conviction_at_entry} />
            </View>
            <Text style={styles.companyName} numberOfLines={1}>{pick.company_name}</Text>
            <Text style={styles.meta}>
              Entry ${pick.entry_price.toFixed(2)} → ${pick.current_price.toFixed(2)}
            </Text>
          </View>

          {/* P&L */}
          <View style={styles.right}>
            <View style={[styles.pnlBadge, { backgroundColor: isPositive ? colors.primary[50] : colors.error[50] }]}>
              <PnlIcon size={12} color={pnlColor} strokeWidth={2} />
              <Text style={[styles.pnlText, { color: pnlColor }]}>
                {isPositive ? '+' : ''}{pick.pnl_percent.toFixed(1)}%
              </Text>
            </View>
            <Text style={[styles.pnlDollars, { color: pnlColor }]}>
              {isPositive ? '+' : ''}${pick.pnl_dollars.toFixed(2)}
            </Text>
            {pick.status === 'active' && (
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={(e) => { e.stopPropagation?.(); onClose(); }}
                disabled={closing}
                hitSlop={8}
              >
                <X size={12} color={colors.error[500]} strokeWidth={2} />
              </TouchableOpacity>
            )}
          </View>
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
  left: { flex: 1, minWidth: 0 },
  right: { alignItems: 'flex-end', gap: 4 },
  tickerRow: {
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
  meta: {
    fontSize: typography.fontSize.xs,
    color: colors.slate[400],
    marginTop: 4,
  },
  pnlBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.md,
  },
  pnlText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },
  pnlDollars: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
  },
  closeBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.error[50],
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
});

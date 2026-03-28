import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { borderRadius, spacing } from '../../theme/spacing';

const CONVICTION_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  'Strong Buy': { bg: '#ecfdf5', text: '#065f46', border: '#a7f3d0' },
  'Buy': { bg: '#f0fdf4', text: '#166534', border: '#bbf7d0' },
  'Hold': { bg: '#fefce8', text: '#854d0e', border: '#fef08a' },
  'Reduce': { bg: '#fff7ed', text: '#9a3412', border: '#fed7aa' },
  'Sell': { bg: '#fef2f2', text: '#991b1b', border: '#fecaca' },
};

export default function ConvictionBadge({ conviction }: { conviction: string }) {
  const style = CONVICTION_STYLES[conviction] || CONVICTION_STYLES['Hold'];
  return (
    <View style={[styles.badge, { backgroundColor: style.bg, borderColor: style.border }]}>
      <Text style={[styles.text, { color: style.text }]}>{conviction}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
  },
});

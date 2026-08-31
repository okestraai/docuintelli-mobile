/**
 * The one control governing Money In, Spending Breakdown and Recurring Bills.
 *
 * They each used to answer a different window — a rolling year, a rolling year, and a single
 * calendar month — with nothing on screen to say so, which left a month's income sitting beside a
 * year's spending looking comparable.
 *
 * Presets carry nearly all real use, so they lead; the custom range answers what a preset cannot.
 * Every preset is built from whole months, because a partial month reports a part as a whole and
 * understates everything measured over it.
 */
import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { CalendarRange, ChevronDown } from 'lucide-react-native';
import TagPicker from '../ui/TagPicker';
import {
  buildPeriods,
  findPeriod,
  customPeriod,
  isCompleteDate,
  type Period,
} from '../../lib/reportingPeriod';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing, borderRadius } from '../../theme/spacing';

const CUSTOM_LABEL = 'Custom range…';

export default function PeriodPicker({
  monthKeys,
  period,
  onChange,
  loading,
}: {
  monthKeys: string[];
  period: Period;
  onChange: (p: Period) => void;
  loading: boolean;
}) {
  const periods = useMemo(() => buildPeriods(monthKeys), [monthKeys]);
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState(period.group === 'custom');
  const [draft, setDraft] = useState({ start: period.start, end: period.end });

  const applyDraft = (next: { start: string; end: string }) => {
    setDraft(next);
    // Native types these, so wait for a complete and ordered pair rather than querying on every
    // keystroke of a half-written date.
    if (!isCompleteDate(next.start) || !isCompleteDate(next.end)) return;
    if (next.start > next.end) return;
    onChange(customPeriod(next.start, next.end));
  };

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <CalendarRange size={16} color={colors.slate[500]} strokeWidth={2} />
        <Text style={styles.label}>Period</Text>

        <TouchableOpacity onPress={() => setOpen(true)} activeOpacity={0.7} style={styles.value}>
          <Text style={styles.valueText} numberOfLines={1}>{period.label}</Text>
          <ChevronDown size={14} color={colors.slate[500]} />
        </TouchableOpacity>
      </View>

      {custom && (
        <View style={styles.customRow}>
          <TextInput
            value={draft.start}
            onChangeText={v => applyDraft({ ...draft, start: v })}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.slate[400]}
            style={styles.dateInput}
            keyboardType={Platform.OS === 'web' ? 'default' : 'numbers-and-punctuation'}
            // @ts-ignore — web-only attribute
            type={Platform.OS === 'web' ? 'date' : undefined}
          />
          <Text style={styles.to}>to</Text>
          <TextInput
            value={draft.end}
            onChangeText={v => applyDraft({ ...draft, end: v })}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.slate[400]}
            style={styles.dateInput}
            keyboardType={Platform.OS === 'web' ? 'default' : 'numbers-and-punctuation'}
            // @ts-ignore — web-only attribute
            type={Platform.OS === 'web' ? 'date' : undefined}
          />
        </View>
      )}

      <Text style={styles.covers}>
        {loading ? 'Updating…' : `Covers ${period.start} to ${period.end}`}
      </Text>

      {/* TagPicker doubles as this app's generic option sheet. */}
      <TagPicker
        visible={open}
        title="Reporting Period"
        options={[...periods.map(p => p.label), CUSTOM_LABEL]}
        existingTags={[]}
        onSelect={(label) => {
          setOpen(false);
          if (label === CUSTOM_LABEL) {
            setCustom(true);
            setDraft({ start: period.start, end: period.end });
            return;
          }
          const picked = periods.find(p => p.label === label);
          if (picked) {
            setCustom(false);
            onChange(findPeriod(periods, picked.id));
          }
        }}
        onClose={() => setOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.slate[200],
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
    gap: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  label: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.slate[700],
  },
  value: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginLeft: 'auto',
    borderWidth: 1,
    borderColor: colors.slate[200],
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    maxWidth: '65%',
  },
  valueText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    color: colors.slate[700],
    flexShrink: 1,
  },
  customRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  dateInput: {
    flex: 1,
    fontSize: typography.fontSize.xs,
    color: colors.slate[700],
    borderWidth: 1,
    borderColor: colors.slate[200],
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: colors.white,
  },
  to: {
    fontSize: typography.fontSize.xs,
    color: colors.slate[400],
  },
  covers: {
    fontSize: typography.fontSize.xs,
    color: colors.slate[500],
  },
});

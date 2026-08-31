import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { BellRing } from 'lucide-react-native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { borderRadius, spacing } from '../../theme/spacing';
import { dueLabel, describePreNotice, obligationUrgency } from '../../lib/obligationScheduling';
import type { Obligation } from '../../lib/obligationsApi';

interface RemindersBannerProps {
  reminders: Obligation[];
  busyId: string | null;
  onComplete: (id: string) => void;
  onOpenList: () => void;
}

/**
 * Promotes the single most urgent reminder out of the header chip when it is overdue or
 * due today.
 *
 * A reminder due in November is a fact and belongs in the chip — the pre-notice ladder
 * delivers it by push and email long before the user opens this screen. An overdue one is
 * different: the ladder has already fired and been missed, so the screen is the last line
 * of defence and has earned the interruption.
 *
 * One item, never a list. Not dismissible either: a commitment is cleared by acting on it.
 */
export default function RemindersBanner({ reminders, busyId, onComplete, onOpenList }: RemindersBannerProps) {
  const today = new Date();
  const item = reminders.find(r => {
    const u = obligationUrgency(r.due_date, today);
    return u === 'overdue' || u === 'today';
  });
  if (!item) return null;

  const overdue = obligationUrgency(item.due_date, today) === 'overdue';
  const tone = overdue
    ? { bg: colors.error[50], border: colors.error[200], pod: colors.error[100], icon: colors.error[600], heading: colors.error[700], body: colors.error[600], cta: colors.error[600] }
    : { bg: colors.warning[50], border: colors.warning[200], pod: colors.warning[100], icon: colors.warning[600], heading: colors.warning[800], body: colors.warning[700], cta: colors.warning[600] };

  return (
    <View style={[styles.banner, { backgroundColor: tone.bg, borderColor: tone.border }]}>
      <View style={[styles.pod, { backgroundColor: tone.pod }]}>
        <BellRing size={16} color={tone.icon} />
      </View>

      <View style={styles.text}>
        <Text style={[styles.title, { color: tone.heading }]} numberOfLines={1}>{item.title}</Text>
        <Text style={[styles.sub, { color: tone.body }]} numberOfLines={1}>
          {dueLabel(item.due_date, today)} · {describePreNotice(item.pre_notice_days)}
        </Text>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          onPress={() => onComplete(item.id)}
          disabled={busyId === item.id}
          style={[styles.cta, { backgroundColor: tone.cta }, busyId === item.id && styles.disabled]}
        >
          {busyId === item.id
            ? <ActivityIndicator size="small" color={colors.white} />
            : <Text style={styles.ctaText}>Mark done</Text>}
        </TouchableOpacity>
        <TouchableOpacity onPress={onOpenList}>
          <Text style={[styles.manage, { color: tone.heading }]}>Manage</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.md,
    borderWidth: 2, borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    marginBottom: spacing.lg,
  },
  pod: { width: 36, height: 36, borderRadius: borderRadius.md, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, minWidth: 140 },
  title: { fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold as any },
  sub: { fontSize: typography.fontSize.xs, marginTop: 2 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  cta: { borderRadius: borderRadius.md, paddingHorizontal: spacing.lg, paddingVertical: 8 },
  ctaText: { fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold as any, color: colors.white },
  manage: { fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.medium as any, textDecorationLine: 'underline' },
  disabled: { opacity: 0.5 },
});

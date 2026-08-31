import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal as RNModal,
  ScrollView, ActivityIndicator, Pressable,
} from 'react-native';
import { Bell, Check, Pencil, Trash2, X } from 'lucide-react-native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { borderRadius, spacing } from '../../theme/spacing';
import { dueLabel, describePreNotice, obligationUrgency } from '../../lib/obligationScheduling';
import ObligationReminderModal from './ObligationReminderModal';
import { updateObligation, type Obligation } from '../../lib/obligationsApi';

const TONE: Record<string, { bg: string; border: string; text: string; icon: string }> = {
  overdue: { bg: colors.error[50], border: colors.error[200], text: colors.error[700], icon: colors.error[600] },
  today: { bg: colors.warning[50], border: colors.warning[200], text: colors.warning[700], icon: colors.warning[600] },
  soon: { bg: colors.warning[50], border: colors.warning[200], text: colors.warning[700], icon: colors.warning[600] },
  upcoming: { bg: colors.white, border: colors.slate[200], text: colors.slate[700], icon: colors.slate[500] },
  undated: { bg: colors.white, border: colors.slate[200], text: colors.slate[700], icon: colors.slate[500] },
};

interface RemindersChipProps {
  reminders: Obligation[];
  busyId: string | null;
  onComplete: (id: string) => void;
  onDelete: (id: string) => void;
  onChanged: () => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Reminders on this document, as a chip in the header's existing action row.
 *
 * Costs no vertical space, so the document stays where it is whether there are zero
 * reminders or five — and unlike the health panel further down the screen, it is not
 * gated by plan. Mirrors the web component; the popover becomes a sheet here, which is
 * the usual web-to-native swap and changes presentation, not information architecture.
 */
export default function RemindersChip({
  reminders, busyId, onComplete, onDelete, onChanged, open, onOpenChange,
}: RemindersChipProps) {
  const [editTarget, setEditTarget] = useState<Obligation | null>(null);

  // Zero reminders renders nothing — no ghost pill, no "0". Most documents have none.
  if (!reminders.length) return null;

  const today = new Date();
  const next = reminders[0];
  const urgency = obligationUrgency(next.due_date, today);
  const tone = TONE[urgency];

  return (
    <>
      <TouchableOpacity
        onPress={() => onOpenChange(true)}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`${reminders.length} reminder${reminders.length === 1 ? '' : 's'} on this document, next ${dueLabel(next.due_date, today)}`}
        style={[styles.chip, { backgroundColor: tone.bg, borderColor: tone.border }]}
      >
        <Bell size={17} color={tone.icon} />
        <View style={[styles.chipCount, { backgroundColor: tone.border }]}>
          <Text style={[styles.chipCountText, { color: tone.text }]}>{reminders.length}</Text>
        </View>
      </TouchableOpacity>

      <RNModal visible={open} transparent animationType="slide" onRequestClose={() => onOpenChange(false)}>
        <Pressable style={styles.backdrop} onPress={() => onOpenChange(false)} />
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Bell size={16} color={colors.slate[500]} />
            <Text style={styles.sheetTitle}>Reminders</Text>
            <Text style={styles.sheetCount}>{reminders.length} on this document</Text>
            <TouchableOpacity onPress={() => onOpenChange(false)} hitSlop={8}>
              <X size={20} color={colors.slate[400]} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.sheetBody}>
            {reminders.map((item, i) => {
              const u = obligationUrgency(item.due_date, today);
              const badge = TONE[u];
              return (
                <View
                  key={item.id}
                  style={[
                    styles.row,
                    i > 0 && styles.rowDivided,
                    u === 'overdue' && styles.rowOverdue,
                    u === 'today' && styles.rowToday,
                  ]}
                >
                  <View style={styles.rowMain}>
                    <View style={styles.titleLine}>
                      <Text style={styles.rowTitle} numberOfLines={2}>{item.title}</Text>
                      <View style={[styles.badge, { backgroundColor: badge.border }]}>
                        <Text style={[styles.badgeText, { color: badge.text }]}>
                          {dueLabel(item.due_date, today)}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.ladderText}>{describePreNotice(item.pre_notice_days)}</Text>
                  </View>

                  <View style={styles.rowActions}>
                    {busyId === item.id ? (
                      <ActivityIndicator size="small" color={colors.slate[400]} />
                    ) : (
                      <>
                        <TouchableOpacity onPress={() => onComplete(item.id)} hitSlop={6} accessibilityLabel="Mark as done" style={styles.iconButton}>
                          <Check size={16} color={colors.slate[400]} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => { onOpenChange(false); setEditTarget(item); }}
                          hitSlop={6}
                          accessibilityLabel="Edit reminder"
                          style={styles.iconButton}
                        >
                          <Pencil size={16} color={colors.slate[400]} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => onDelete(item.id)} hitSlop={6} accessibilityLabel="Delete reminder" style={styles.iconButton}>
                          <Trash2 size={16} color={colors.slate[400]} />
                        </TouchableOpacity>
                      </>
                    )}
                  </View>
                </View>
              );
            })}
          </ScrollView>
        </View>
      </RNModal>

      <ObligationReminderModal
        obligation={editTarget}
        mode="edit"
        onClose={() => setEditTarget(null)}
        onSubmit={async (dueDate, preNoticeDays) => {
          if (!editTarget) return;
          await updateObligation(editTarget.id, { due_date: dueDate, pre_notice_days: preNoticeDays });
          onChanged();
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderWidth: 1, borderRadius: borderRadius.md,
    paddingHorizontal: 8, paddingVertical: 6,
  },
  chipCount: { borderRadius: borderRadius.full, paddingHorizontal: 5, paddingVertical: 1, minWidth: 18, alignItems: 'center' },
  chipCountText: { fontSize: 11, fontWeight: typography.fontWeight.bold as any },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(15, 23, 42, 0.6)' },
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    maxHeight: '70%',
    backgroundColor: colors.white,
    borderTopLeftRadius: borderRadius.xl, borderTopRightRadius: borderRadius.xl,
    overflow: 'hidden',
  },
  sheetHeader: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.slate[100],
  },
  sheetTitle: { fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.bold as any, color: colors.slate[900] },
  sheetCount: { marginLeft: 'auto', fontSize: typography.fontSize.xs, color: colors.slate[500] },
  sheetBody: { paddingBottom: spacing.xl },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  rowDivided: { borderTopWidth: 1, borderTopColor: colors.slate[100] },
  rowOverdue: { borderLeftWidth: 4, borderLeftColor: colors.error[500], paddingLeft: spacing.md },
  rowToday: { borderLeftWidth: 4, borderLeftColor: colors.warning[500], paddingLeft: spacing.md },
  rowMain: { flex: 1 },
  titleLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  rowTitle: { flexShrink: 1, fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold as any, color: colors.slate[900] },
  badge: { borderRadius: borderRadius.full, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { fontSize: 11, fontWeight: typography.fontWeight.bold as any },
  ladderText: { fontSize: 11, color: colors.slate[400], marginTop: 4 },
  rowActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  iconButton: { padding: 6 },
});

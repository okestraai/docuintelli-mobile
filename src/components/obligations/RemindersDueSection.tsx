import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Bell, ClipboardCheck, ChevronRight, Check } from 'lucide-react-native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { borderRadius, spacing } from '../../theme/spacing';
import {
  listObligations, getObligationCounts, completeObligation, type Obligation,
} from '../../lib/obligationsApi';
import { groupObligations, dueLabel, obligationUrgency, describePreNotice } from '../../lib/obligationScheduling';

const URGENCY_STYLE: Record<string, { bg: string; text: string }> = {
  overdue: { bg: colors.error[100], text: colors.error[700] },
  today: { bg: colors.warning[100], text: colors.warning[700] },
  soon: { bg: colors.warning[50], text: colors.warning[700] },
  upcoming: { bg: colors.slate[100], text: colors.slate[600] },
  undated: { bg: colors.slate[100], text: colors.slate[500] },
};

/**
 * Reminders coming due, for the Vault's Health tab. Mirrors the web component.
 *
 * Time-grouped, not document-grouped: this answers "am I late for anything", and burying
 * that under document headers would cost a tap per document to find out. Triage of
 * unreviewed items is the opposite — it belongs on the document, so this only links there.
 */
export default function RemindersDueSection() {
  const router = useRouter();
  const [reminders, setReminders] = useState<Obligation[]>([]);
  const [pending, setPending] = useState({ documents: 0, items: 0 });
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [active, counts] = await Promise.all([
        listObligations({ status: ['active'], limit: 50 }),
        getObligationCounts(),
      ]);
      setReminders(active.items);
      setPending({ documents: counts.documentsWithSuggestions, items: counts.totalSuggested });
    } catch {
      /* non-critical — the section just stays hidden */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const complete = async (id: string) => {
    setBusyId(id);
    try {
      await completeObligation(id);
      await load();
    } finally {
      setBusyId(null);
    }
  };

  if (loading) return null;

  const today = new Date();
  // Only what is actually coming at the user — anything further out lives on its document.
  const due = reminders.filter(r => ['overdue', 'today', 'soon'].includes(obligationUrgency(r.due_date, today)));
  const groups = groupObligations(due, today);

  if (!due.length && !pending.items) return null;

  return (
    <View style={styles.wrap}>
      {pending.items > 0 && (
        <View style={styles.rollup}>
          <View style={styles.rollupIcon}>
            <ClipboardCheck size={16} color={colors.primary[600]} />
          </View>
          <View style={styles.rollupText}>
            <Text style={styles.rollupTitle}>
              {pending.items} action item{pending.items === 1 ? '' : 's'} to review
            </Text>
            <Text style={styles.rollupSub}>
              Across {pending.documents} document{pending.documents === 1 ? '' : 's'} — open a document to review and set reminders
            </Text>
          </View>
        </View>
      )}

      {due.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Bell size={15} color={colors.slate[500]} />
            <Text style={styles.sectionTitle}>Reminders due</Text>
            <View style={styles.countPill}><Text style={styles.countPillText}>{due.length}</Text></View>
          </View>

          {groups.map(group => (
            <View key={group.key}>
              <Text style={[styles.groupLabel, group.key === 'overdue' && styles.groupLabelUrgent]}>
                {group.label}
              </Text>
              {group.items.map((item, i) => {
                const urgency = obligationUrgency(item.due_date, today);
                const badge = URGENCY_STYLE[urgency];
                return (
                  <View
                    key={item.id}
                    style={[styles.row, i > 0 && styles.rowDivided, urgency === 'overdue' && styles.rowOverdue]}
                  >
                    <View style={styles.rowMain}>
                      <View style={styles.titleLine}>
                        <Text style={styles.rowTitle} numberOfLines={2}>{item.title}</Text>
                        <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                          <Text style={[styles.badgeText, { color: badge.text }]}>
                            {dueLabel(item.due_date, today)}
                          </Text>
                        </View>
                      </View>
                      <TouchableOpacity
                        style={styles.docLink}
                        onPress={() => router.push({ pathname: '/document/[id]', params: { id: item.document_id } })}
                      >
                        <ChevronRight size={13} color={colors.slate[400]} />
                        <Text style={styles.docLinkText} numberOfLines={1}>{item.document_name}</Text>
                      </TouchableOpacity>
                      <Text style={styles.ladderText}>{describePreNotice(item.pre_notice_days)}</Text>
                    </View>

                    <TouchableOpacity
                      onPress={() => complete(item.id)}
                      disabled={busyId === item.id}
                      accessibilityLabel="Mark as done"
                      style={styles.iconButton}
                    >
                      {busyId === item.id
                        ? <ActivityIndicator size="small" color={colors.slate[400]} />
                        : <Check size={16} color={colors.slate[400]} />}
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md, marginBottom: spacing.lg },
  rollup: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.white, borderWidth: 1, borderColor: colors.slate[200],
    borderRadius: borderRadius.lg, paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
  },
  rollupIcon: {
    width: 36, height: 36, borderRadius: borderRadius.md,
    backgroundColor: colors.primary[50], alignItems: 'center', justifyContent: 'center',
  },
  rollupText: { flex: 1 },
  rollupTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold as any,
    color: colors.slate[900],
  },
  rollupSub: { fontSize: typography.fontSize.xs, color: colors.slate[500], marginTop: 2 },
  section: {
    backgroundColor: colors.white, borderWidth: 1, borderColor: colors.slate[200],
    borderRadius: borderRadius.lg, overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.slate[100],
  },
  sectionTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold as any,
    color: colors.slate[900],
  },
  countPill: { backgroundColor: colors.slate[100], borderRadius: borderRadius.full, paddingHorizontal: 8, paddingVertical: 2 },
  countPillText: { fontSize: 11, fontWeight: typography.fontWeight.bold as any, color: colors.slate[600] },
  groupLabel: {
    fontSize: 11, fontWeight: typography.fontWeight.bold as any, color: colors.slate[400],
    textTransform: 'uppercase', letterSpacing: 0.5,
    paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: 4,
  },
  groupLabelUrgent: { color: colors.error[600] },
  row: {
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
  },
  rowDivided: { borderTopWidth: 1, borderTopColor: colors.slate[100] },
  rowOverdue: { borderLeftWidth: 4, borderLeftColor: colors.error[500], paddingLeft: spacing.md },
  rowMain: { flex: 1 },
  titleLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  rowTitle: {
    flexShrink: 1, fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold as any, color: colors.slate[900],
  },
  badge: { borderRadius: borderRadius.full, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { fontSize: 11, fontWeight: typography.fontWeight.bold as any },
  docLink: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  docLinkText: { flex: 1, fontSize: typography.fontSize.xs, color: colors.slate[500] },
  ladderText: { fontSize: 11, color: colors.slate[400], marginTop: 2 },
  iconButton: { padding: 6 },
});

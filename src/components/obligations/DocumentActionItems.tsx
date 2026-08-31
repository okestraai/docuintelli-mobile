import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import {
  ClipboardCheck, Check, X, Bell, Pencil, Trash2, Sparkles,
  CalendarClock, Hourglass, Undo2,
} from 'lucide-react-native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { borderRadius, spacing } from '../../theme/spacing';
import ObligationReminderModal from './ObligationReminderModal';
import { describePreNotice, dueLabel, obligationUrgency } from '../../lib/obligationScheduling';
import {
  listObligations, acceptObligation, dismissObligation, completeObligation,
  deleteObligation, bulkDismissForDocument, bulkRestore, ObligationApiError,
  type Obligation,
} from '../../lib/obligationsApi';

interface DocumentActionItemsProps {
  documentId: string;
  onCountChange?: () => void;
}

const INITIAL_VISIBLE = 5;
const REVEAL_STEP = 10;

const URGENCY_STYLE: Record<string, { bg: string; text: string }> = {
  overdue: { bg: colors.error[100], text: colors.error[700] },
  today: { bg: colors.warning[100], text: colors.warning[700] },
  soon: { bg: colors.warning[50], text: colors.warning[700] },
  upcoming: { bg: colors.slate[100], text: colors.slate[600] },
  undated: { bg: colors.slate[100], text: colors.slate[500] },
};

/**
 * The action items extracted from one document, and the reminders already set on it.
 *
 * Mirrors the web component of the same name. Lives in the document screen's main body
 * rather than inside DocumentHealthPanel, which is paid-only — most documents belong to
 * free users, so gating this would hide it from nearly everyone who has it.
 */
export default function DocumentActionItems({ documentId, onCountChange }: DocumentActionItemsProps) {
  const [suggestions, setSuggestions] = useState<Obligation[]>([]);
  const [reminders, setReminders] = useState<Obligation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [visible, setVisible] = useState(INITIAL_VISIBLE);
  const [modalTarget, setModalTarget] = useState<{ obligation: Obligation; mode: 'accept' | 'edit' } | null>(null);
  const [limitReached, setLimitReached] = useState<string | null>(null);
  const [undo, setUndo] = useState<{ ids: string[]; label: string } | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [pending, active] = await Promise.all([
        listObligations({ documentId, status: ['suggested'], limit: 100 }),
        listObligations({ documentId, status: ['active'], limit: 100 }),
      ]);
      // Dated items first — only a small minority carry a real date, and those are the
      // ones actually worth acting on.
      setSuggestions(
        [...pending.items].sort((a, b) => {
          if (!!a.suggested_due_date === !!b.suggested_due_date) return 0;
          return a.suggested_due_date ? -1 : 1;
        }),
      );
      setReminders(active.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load action items');
    } finally {
      setLoading(false);
    }
  }, [documentId]);

  useEffect(() => { void load(); }, [load]);

  const run = async (id: string, action: () => Promise<unknown>) => {
    setBusyId(id);
    try {
      await action();
      await load();
      onCountChange?.();
    } finally {
      setBusyId(null);
    }
  };

  const handleAccept = async (dueDate: string, preNoticeDays: number[]) => {
    if (!modalTarget) return;
    try {
      setLimitReached(null);
      await acceptObligation(modalTarget.obligation.id, dueDate, preNoticeDays);
      await load();
      onCountChange?.();
    } catch (err) {
      if (err instanceof ObligationApiError && err.code === 'OBLIGATION_LIMIT_REACHED') {
        setLimitReached(err.message);
        return;
      }
      throw err;
    }
  };

  const ignoreAll = async () => {
    const n = suggestions.length;
    const res = await bulkDismissForDocument(documentId);
    await load();
    onCountChange?.();
    setUndo({ ids: res.ids, label: `Ignored ${res.dismissed} of ${n} action items` });
  };

  const runUndo = async () => {
    if (!undo) return;
    await bulkRestore(undo.ids);
    setUndo(null);
    await load();
    onCountChange?.();
  };

  if (loading) {
    return (
      <View style={styles.card}>
        <ActivityIndicator size="small" color={colors.primary[600]} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorBox}>
        <Text style={styles.errorText}>We couldn't load this document's action items.</Text>
        <TouchableOpacity onPress={() => { setLoading(true); void load(); }}>
          <Text style={styles.retryLink}>Try again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!suggestions.length && !reminders.length) {
    return (
      <View style={styles.emptyCard}>
        <ClipboardCheck size={22} color={colors.slate[300]} />
        <Text style={styles.emptyText}>No action items found in this document.</Text>
      </View>
    );
  }

  const shown = suggestions.slice(0, visible);
  const hidden = suggestions.length - shown.length;

  return (
    <View style={styles.wrap}>
      {!!limitReached && (
        <View style={styles.limitBox}>
          <Text style={styles.limitText}>{limitReached}</Text>
        </View>
      )}

      {!!undo && (
        <View style={styles.undoBar}>
          <Text style={styles.undoText} numberOfLines={1}>{undo.label}</Text>
          <TouchableOpacity onPress={runUndo} style={styles.undoAction}>
            <Undo2 size={14} color={colors.primary[700]} />
            <Text style={styles.undoLink}>Undo</Text>
          </TouchableOpacity>
        </View>
      )}

      {suggestions.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Sparkles size={15} color={colors.primary[600]} />
            <Text style={styles.sectionTitle}>Action items to review</Text>
            <View style={styles.countPill}>
              <Text style={styles.countPillText}>{suggestions.length}</Text>
            </View>
            <TouchableOpacity onPress={ignoreAll} style={styles.ignoreAll}>
              <Text style={styles.ignoreAllText}>Ignore all</Text>
            </TouchableOpacity>
          </View>

          {shown.map((item, i) => (
            <SuggestionRow
              key={item.id}
              obligation={item}
              first={i === 0}
              busy={busyId === item.id}
              onAdd={() => setModalTarget({ obligation: item, mode: 'accept' })}
              onIgnore={() => run(item.id, () => dismissObligation(item.id))}
            />
          ))}

          {hidden > 0 && (
            <TouchableOpacity onPress={() => setVisible(v => v + REVEAL_STEP)} style={styles.showMore}>
              <Text style={styles.showMoreText}>Show {Math.min(hidden, REVEAL_STEP)} more</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {reminders.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Bell size={15} color={colors.slate[500]} />
            <Text style={styles.sectionTitle}>Reminders</Text>
            <View style={styles.countPillNeutral}>
              <Text style={styles.countPillNeutralText}>{reminders.length}</Text>
            </View>
          </View>

          {reminders.map((item, i) => (
            <ReminderRow
              key={item.id}
              obligation={item}
              first={i === 0}
              busy={busyId === item.id}
              onEdit={() => setModalTarget({ obligation: item, mode: 'edit' })}
              onComplete={() => run(item.id, () => completeObligation(item.id))}
              onDelete={() => run(item.id, () => deleteObligation(item.id))}
            />
          ))}
        </View>
      )}

      <ObligationReminderModal
        obligation={modalTarget?.obligation ?? null}
        mode={modalTarget?.mode ?? 'accept'}
        onClose={() => setModalTarget(null)}
        onSubmit={handleAccept}
      />
    </View>
  );
}

// ── Suggestion row ──────────────────────────────────────────────────────────────

function SuggestionRow({
  obligation, first, busy, onAdd, onIgnore,
}: {
  obligation: Obligation;
  first: boolean;
  busy: boolean;
  onAdd: () => void;
  onIgnore: () => void;
}) {
  const [showSource, setShowSource] = useState(false);

  return (
    <View style={[styles.row, !first && styles.rowDivided]}>
      <View style={styles.rowMain}>
        <Text style={styles.rowTitle}>{obligation.title}</Text>
        {!!obligation.description && (
          <Text style={styles.rowDesc} numberOfLines={2}>{obligation.description}</Text>
        )}

        <View style={styles.metaRow}>
          {obligation.suggested_due_date ? (
            <View style={styles.datePill}>
              <CalendarClock size={13} color={colors.warning[700]} />
              <Text style={styles.datePillText}>{obligation.suggested_due_date}</Text>
            </View>
          ) : obligation.suggested_due_text ? (
            <View style={styles.relativeWrap}>
              <Hourglass size={13} color={colors.slate[400]} />
              <Text style={styles.relativeText} numberOfLines={1}>{obligation.suggested_due_text}</Text>
            </View>
          ) : (
            <Text style={styles.noDateText}>No date suggested</Text>
          )}

          {!!obligation.source_excerpt && (
            <TouchableOpacity onPress={() => setShowSource(v => !v)}>
              <Text style={styles.whyLink}>{showSource ? 'Hide source' : 'Why?'}</Text>
            </TouchableOpacity>
          )}
        </View>

        {showSource && !!obligation.source_excerpt && (
          <View style={styles.quoteWrap}>
            <Text style={styles.quote}>{obligation.source_excerpt}</Text>
          </View>
        )}
      </View>

      {/* Compact cluster. Add is primary by colour, not by area — a full-width button per
          row reads as "this is the one thing to do", once per row. */}
      <View style={styles.actions}>
        <TouchableOpacity
          onPress={onIgnore}
          disabled={busy}
          accessibilityLabel="Ignore this action item"
          style={[styles.iconButton, busy && styles.disabled]}
        >
          {busy ? <ActivityIndicator size="small" color={colors.slate[400]} /> : <X size={16} color={colors.slate[400]} />}
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onAdd}
          disabled={busy}
          style={[styles.addButton, busy && styles.disabled]}
        >
          <Check size={15} color={colors.white} />
          <Text style={styles.addButtonText}>Add</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Reminder row ────────────────────────────────────────────────────────────────

function ReminderRow({
  obligation, first, busy, onEdit, onComplete, onDelete,
}: {
  obligation: Obligation;
  first: boolean;
  busy: boolean;
  onEdit: () => void;
  onComplete: () => void;
  onDelete: () => void;
}) {
  const today = new Date();
  const urgency = obligationUrgency(obligation.due_date, today);
  const badge = URGENCY_STYLE[urgency];

  return (
    <View style={[
      styles.row,
      !first && styles.rowDivided,
      urgency === 'overdue' && styles.rowOverdue,
      urgency === 'today' && styles.rowToday,
    ]}>
      <View style={styles.rowMain}>
        <View style={styles.titleLine}>
          <Text style={styles.rowTitle} numberOfLines={2}>{obligation.title}</Text>
          <View style={[styles.badge, { backgroundColor: badge.bg }]}>
            <Text style={[styles.badgeText, { color: badge.text }]}>{dueLabel(obligation.due_date, today)}</Text>
          </View>
        </View>
        <Text style={styles.ladderText}>{describePreNotice(obligation.pre_notice_days)}</Text>
      </View>

      <View style={styles.actions}>
        {busy ? (
          <ActivityIndicator size="small" color={colors.slate[400]} />
        ) : (
          <>
            <TouchableOpacity onPress={onComplete} hitSlop={6} accessibilityLabel="Mark as done" style={styles.iconButton}>
              <Check size={16} color={colors.slate[400]} />
            </TouchableOpacity>
            <TouchableOpacity onPress={onEdit} hitSlop={6} accessibilityLabel="Edit reminder" style={styles.iconButton}>
              <Pencil size={16} color={colors.slate[400]} />
            </TouchableOpacity>
            <TouchableOpacity onPress={onDelete} hitSlop={6} accessibilityLabel="Delete reminder" style={styles.iconButton}>
              <Trash2 size={16} color={colors.slate[400]} />
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  card: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.slate[200],
    padding: spacing.lg,
    alignItems: 'center',
  },
  section: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.slate[200],
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate[100],
  },
  sectionTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold as any,
    color: colors.slate[900],
  },
  countPill: { backgroundColor: colors.primary[100], borderRadius: borderRadius.full, paddingHorizontal: 8, paddingVertical: 2 },
  countPillText: { fontSize: 11, fontWeight: typography.fontWeight.bold as any, color: colors.primary[700] },
  countPillNeutral: { backgroundColor: colors.slate[100], borderRadius: borderRadius.full, paddingHorizontal: 8, paddingVertical: 2 },
  countPillNeutralText: { fontSize: 11, fontWeight: typography.fontWeight.bold as any, color: colors.slate[600] },
  ignoreAll: { marginLeft: 'auto' },
  ignoreAllText: { fontSize: typography.fontSize.xs, color: colors.slate[500], textDecorationLine: 'underline' },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  rowDivided: { borderTopWidth: 1, borderTopColor: colors.slate[100] },
  rowOverdue: { borderLeftWidth: 4, borderLeftColor: colors.error[500], paddingLeft: spacing.md },
  rowToday: { borderLeftWidth: 4, borderLeftColor: colors.warning[500], paddingLeft: spacing.md },
  rowMain: { flex: 1 },
  titleLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  rowTitle: {
    flexShrink: 1,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold as any,
    color: colors.slate[900],
  },
  rowDesc: { fontSize: typography.fontSize.sm, color: colors.slate[600], marginTop: 2 },
  // Gapped flex — chaining these inline is what previously ran the metadata straight into
  // the "Why?" link with no space between them.
  metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.md, marginTop: 6 },
  datePill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.warning[50], borderRadius: borderRadius.sm,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  datePillText: { fontSize: typography.fontSize.xs, color: colors.warning[700], fontWeight: typography.fontWeight.medium as any },
  relativeWrap: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 },
  relativeText: { flexShrink: 1, fontSize: typography.fontSize.xs, color: colors.slate[500] },
  noDateText: { fontSize: typography.fontSize.xs, color: colors.slate[400] },
  whyLink: { fontSize: typography.fontSize.xs, color: colors.slate[500], textDecorationLine: 'underline' },
  quoteWrap: { marginTop: spacing.sm, borderLeftWidth: 2, borderLeftColor: colors.slate[200], paddingLeft: spacing.md },
  quote: { fontSize: typography.fontSize.xs, color: colors.slate[500], fontStyle: 'italic' },
  ladderText: { fontSize: 11, color: colors.slate[400], marginTop: 4 },
  badge: { borderRadius: borderRadius.full, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { fontSize: 11, fontWeight: typography.fontWeight.bold as any },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  iconButton: { padding: 6 },
  addButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    backgroundColor: colors.primary[600], borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md, paddingVertical: 8, minWidth: 78,
  },
  addButtonText: { fontSize: typography.fontSize.sm, color: colors.white, fontWeight: typography.fontWeight.semibold as any },
  showMore: {
    paddingVertical: spacing.sm + 2, alignItems: 'center',
    borderTopWidth: 1, borderTopColor: colors.slate[100],
  },
  showMoreText: { fontSize: typography.fontSize.sm, color: colors.slate[600], fontWeight: typography.fontWeight.medium as any },
  emptyCard: {
    backgroundColor: colors.white, borderRadius: borderRadius.lg, borderWidth: 1,
    borderColor: colors.slate[200], paddingVertical: spacing.xl, alignItems: 'center', gap: spacing.sm,
  },
  emptyText: { fontSize: typography.fontSize.sm, color: colors.slate[500] },
  errorBox: {
    backgroundColor: colors.error[50], borderWidth: 1, borderColor: colors.error[200],
    borderRadius: borderRadius.lg, padding: spacing.md,
  },
  errorText: { fontSize: typography.fontSize.sm, color: colors.error[700] },
  retryLink: {
    fontSize: typography.fontSize.sm, color: colors.error[700],
    fontWeight: typography.fontWeight.semibold as any, textDecorationLine: 'underline', marginTop: 6,
  },
  limitBox: {
    backgroundColor: colors.warning[50], borderWidth: 1, borderColor: colors.warning[200],
    borderRadius: borderRadius.lg, padding: spacing.md,
  },
  limitText: { fontSize: typography.fontSize.sm, color: colors.warning[800] },
  undoBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md,
    backgroundColor: colors.slate[50], borderWidth: 1, borderColor: colors.slate[200],
    borderRadius: borderRadius.lg, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm + 2,
  },
  undoText: { flex: 1, fontSize: typography.fontSize.sm, color: colors.slate[600] },
  undoAction: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  undoLink: { fontSize: typography.fontSize.sm, color: colors.primary[700], fontWeight: typography.fontWeight.semibold as any },
  disabled: { opacity: 0.5 },
});

import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import {
  ClipboardCheck, FileText, Check, X, Bell, Pencil, Trash2, Sparkles, AlertTriangle,
} from 'lucide-react-native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { borderRadius, spacing } from '../../theme/spacing';
import { useObligations } from '../../hooks/useObligations';
import ObligationReminderModal from './ObligationReminderModal';
import {
  groupObligations, describePreNotice, dueLabel, obligationUrgency,
} from '../../lib/obligationScheduling';
import { ObligationApiError, type Obligation } from '../../lib/obligationsApi';

interface ObligationsPanelProps {
  /** Lets the Vault keep its tab badge in step with the panel. */
  onSummaryChange?: (counts: { suggested: number; overdue: number }) => void;
  /** Bumped by the parent on screen focus to force a refetch. */
  refreshToken?: number;
}

const URGENCY_STYLE: Record<string, { bg: string; text: string }> = {
  overdue: { bg: colors.error[100], text: colors.error[700] },
  today: { bg: colors.warning[100], text: colors.warning[700] },
  soon: { bg: colors.warning[50], text: colors.warning[700] },
  upcoming: { bg: colors.slate[100], text: colors.slate[600] },
  undated: { bg: colors.slate[100], text: colors.slate[500] },
};

export default function ObligationsPanel({ onSummaryChange, refreshToken }: ObligationsPanelProps) {
  const router = useRouter();
  const {
    suggestions, reminders, summary, loading, error, actionLoading,
    hasMoreReminders, loadMoreReminders, refresh, accept, dismiss, complete, remove,
  } = useObligations();

  const [modalTarget, setModalTarget] = useState<{ obligation: Obligation; mode: 'accept' | 'edit' } | null>(null);
  const [limitReached, setLimitReached] = useState<string | null>(null);

  // The Vault refetches on focus; this pulls the panel along with it.
  useEffect(() => {
    if (refreshToken !== undefined) void refresh();
  }, [refreshToken, refresh]);

  const suggestedCount = summary?.suggested ?? suggestions.length;
  const overdueCount = summary?.overdue ?? 0;
  useEffect(() => {
    onSummaryChange?.({ suggested: suggestedCount, overdue: overdueCount });
  }, [onSummaryChange, suggestedCount, overdueCount]);

  const openDocument = useCallback((documentId: string) => {
    router.push({ pathname: '/document/[id]', params: { id: documentId } });
  }, [router]);

  const handleSubmit = async (dueDate: string, preNoticeDays: number[]) => {
    if (!modalTarget) return;
    try {
      setLimitReached(null);
      await accept(modalTarget.obligation.id, dueDate, preNoticeDays);
    } catch (err) {
      // A plan-cap rejection is a prompt to upgrade, not an error to shout about.
      if (err instanceof ObligationApiError && err.code === 'OBLIGATION_LIMIT_REACHED') {
        setLimitReached(err.message);
        return;
      }
      throw err;
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary[600]} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorBox}>
        <Text style={styles.errorBoxText}>{error}</Text>
      </View>
    );
  }

  const today = new Date();
  const groups = groupObligations(reminders, today);
  const isEmpty = suggestions.length === 0 && reminders.length === 0;

  // A plain View, not a ScrollView: this panel is rendered inside the Vault screen's
  // ScrollView, and nesting two would break scrolling on both.
  return (
    <View style={styles.content}>
      {!!limitReached && (
        <View style={styles.limitBox}>
          <AlertTriangle size={18} color={colors.warning[600]} />
          <View style={styles.limitTextWrap}>
            <Text style={styles.limitText}>{limitReached}</Text>
            <TouchableOpacity onPress={() => router.push('/billing')}>
              <Text style={styles.limitLink}>Upgrade for more reminders</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {isEmpty && (
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <ClipboardCheck size={28} color={colors.slate[400]} />
          </View>
          <Text style={styles.emptyTitle}>No action items yet</Text>
          <Text style={styles.emptyBody}>
            Upload a contract, lease, or policy and we'll scan it for deadlines you can turn into reminders.
          </Text>
        </View>
      )}

      {/* ── Suggestions awaiting a decision ── */}
      {suggestions.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Sparkles size={15} color={colors.primary[600]} />
            <Text style={styles.sectionTitle}>Action items to review</Text>
            <View style={styles.sectionCount}>
              <Text style={styles.sectionCountText}>{suggestions.length}</Text>
            </View>
          </View>

          {suggestions.map(item => (
            <SuggestionCard
              key={item.id}
              obligation={item}
              busy={actionLoading === item.id}
              onAdd={() => setModalTarget({ obligation: item, mode: 'accept' })}
              onIgnore={() => dismiss(item.id)}
              onOpenDocument={openDocument}
            />
          ))}
        </View>
      )}

      {/* ── Live reminders ── */}
      {reminders.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Bell size={15} color={colors.slate[500]} />
            <Text style={styles.sectionTitle}>Your reminders</Text>
          </View>

          {groups.map(group => (
            <View key={group.key} style={styles.group}>
              <Text style={[styles.groupLabel, group.key === 'overdue' && styles.groupLabelUrgent]}>
                {group.label}
              </Text>
              {group.items.map(item => (
                <ReminderRow
                  key={item.id}
                  obligation={item}
                  today={today}
                  busy={actionLoading === item.id}
                  onEdit={() => setModalTarget({ obligation: item, mode: 'edit' })}
                  onComplete={() => complete(item.id)}
                  onDelete={() => remove(item.id)}
                  onOpenDocument={openDocument}
                />
              ))}
            </View>
          ))}

          {hasMoreReminders && (
            <TouchableOpacity style={styles.loadMore} onPress={loadMoreReminders}>
              <Text style={styles.loadMoreText}>Load more</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      <ObligationReminderModal
        obligation={modalTarget?.obligation ?? null}
        mode={modalTarget?.mode ?? 'accept'}
        onClose={() => setModalTarget(null)}
        onSubmit={
          modalTarget?.mode === 'edit'
            ? async (dueDate, preNoticeDays) => {
                // Editing reuses accept: it rewrites the date and ladder, and the
                // re-armed dedup key means the new schedule actually fires.
                await accept(modalTarget.obligation.id, dueDate, preNoticeDays);
              }
            : handleSubmit
        }
      />
    </View>
  );
}

// ── Suggestion card ─────────────────────────────────────────────────────────────

function SuggestionCard({
  obligation, busy, onAdd, onIgnore, onOpenDocument,
}: {
  obligation: Obligation;
  busy: boolean;
  onAdd: () => void;
  onIgnore: () => void;
  onOpenDocument: (documentId: string) => void;
}) {
  const [showSource, setShowSource] = useState(false);

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{obligation.title}</Text>
      {!!obligation.description && <Text style={styles.cardBody}>{obligation.description}</Text>}

      <TouchableOpacity style={styles.docLink} onPress={() => onOpenDocument(obligation.document_id)}>
        <FileText size={13} color={colors.slate[400]} />
        <Text style={styles.docLinkText} numberOfLines={1}>{obligation.document_name}</Text>
      </TouchableOpacity>

      {(!!obligation.suggested_due_date || !!obligation.suggested_due_text) && (
        <View style={styles.suggestionNote}>
          <Sparkles size={13} color={colors.warning[700]} />
          <Text style={styles.suggestionNoteText}>
            {obligation.suggested_due_date
              ? `Suggested date: ${obligation.suggested_due_date} — confirm before saving`
              : `Due ${obligation.suggested_due_text}`}
          </Text>
        </View>
      )}

      {!!obligation.source_excerpt && (
        <>
          <TouchableOpacity onPress={() => setShowSource(v => !v)}>
            <Text style={styles.whyLink}>{showSource ? 'Hide source' : 'Why?'}</Text>
          </TouchableOpacity>
          {showSource && (
            <View style={styles.quoteWrap}>
              <Text style={styles.quote}>{obligation.source_excerpt}</Text>
            </View>
          )}
        </>
      )}

      <View style={styles.cardActions}>
        <TouchableOpacity
          style={[styles.primaryAction, busy && styles.disabled]}
          onPress={onAdd}
          disabled={busy}
        >
          <Check size={16} color={colors.white} />
          <Text style={styles.primaryActionText}>Add reminder</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.secondaryAction, busy && styles.disabled]}
          onPress={onIgnore}
          disabled={busy}
        >
          {busy
            ? <ActivityIndicator size="small" color={colors.slate[500]} />
            : <X size={16} color={colors.slate[600]} />}
          <Text style={styles.secondaryActionText}>Ignore</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Reminder row ────────────────────────────────────────────────────────────────

function ReminderRow({
  obligation, today, busy, onEdit, onComplete, onDelete, onOpenDocument,
}: {
  obligation: Obligation;
  today: Date;
  busy: boolean;
  onEdit: () => void;
  onComplete: () => void;
  onDelete: () => void;
  onOpenDocument: (documentId: string) => void;
}) {
  const urgency = obligationUrgency(obligation.due_date, today);
  const badge = URGENCY_STYLE[urgency];

  return (
    <View style={styles.row}>
      <View style={styles.rowMain}>
        <View style={styles.rowTitleLine}>
          <Text style={styles.rowTitle} numberOfLines={2}>{obligation.title}</Text>
          <View style={[styles.badge, { backgroundColor: badge.bg }]}>
            <Text style={[styles.badgeText, { color: badge.text }]}>
              {dueLabel(obligation.due_date, today)}
            </Text>
          </View>
        </View>

        <TouchableOpacity style={styles.docLink} onPress={() => onOpenDocument(obligation.document_id)}>
          <FileText size={13} color={colors.slate[400]} />
          <Text style={styles.docLinkText} numberOfLines={1}>{obligation.document_name}</Text>
        </TouchableOpacity>

        <Text style={styles.ladderText}>{describePreNotice(obligation.pre_notice_days)}</Text>
      </View>

      <View style={styles.rowActions}>
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
  content: { paddingBottom: spacing['3xl'] },
  centered: { paddingVertical: spacing['3xl'] * 2, alignItems: 'center' },
  section: { marginBottom: spacing['2xl'] },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  sectionTitle: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold as any,
    color: colors.slate[900],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionCount: {
    backgroundColor: colors.primary[100],
    borderRadius: borderRadius.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  sectionCountText: {
    fontSize: 11,
    fontWeight: typography.fontWeight.bold as any,
    color: colors.primary[700],
  },
  group: { marginBottom: spacing.lg },
  groupLabel: {
    fontSize: 11,
    fontWeight: typography.fontWeight.bold as any,
    color: colors.slate[400],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  groupLabelUrgent: { color: colors.error[600] },
  card: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.slate[200],
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  cardTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold as any,
    color: colors.slate[900],
  },
  cardBody: { fontSize: typography.fontSize.sm, color: colors.slate[600], marginTop: 4 },
  docLink: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.sm },
  docLinkText: { flex: 1, fontSize: typography.fontSize.xs, color: colors.slate[500] },
  suggestionNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: spacing.sm },
  suggestionNoteText: { flex: 1, fontSize: typography.fontSize.xs, color: colors.warning[700] },
  whyLink: {
    fontSize: typography.fontSize.xs,
    color: colors.slate[500],
    textDecorationLine: 'underline',
    marginTop: spacing.sm,
  },
  quoteWrap: {
    marginTop: spacing.sm,
    borderLeftWidth: 2,
    borderLeftColor: colors.slate[200],
    paddingLeft: spacing.md,
  },
  quote: { fontSize: typography.fontSize.xs, color: colors.slate[500], fontStyle: 'italic' },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.slate[100],
  },
  primaryAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.primary[600],
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm + 2,
  },
  primaryActionText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold as any,
    color: colors.white,
  },
  secondaryAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.slate[300],
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.lg,
  },
  secondaryActionText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium as any,
    color: colors.slate[600],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.slate[200],
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    marginBottom: spacing.sm,
  },
  rowMain: { flex: 1 },
  rowTitleLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  rowTitle: {
    flexShrink: 1,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold as any,
    color: colors.slate[900],
  },
  badge: { borderRadius: borderRadius.full, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { fontSize: 11, fontWeight: typography.fontWeight.bold as any },
  ladderText: { fontSize: 11, color: colors.slate[400], marginTop: 4 },
  rowActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  iconButton: { padding: 6 },
  loadMore: {
    borderWidth: 1,
    borderColor: colors.slate[300],
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.sm + 2,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  loadMoreText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium as any,
    color: colors.slate[600],
  },
  emptyState: { alignItems: 'center', paddingVertical: spacing['3xl'] * 1.5, paddingHorizontal: spacing.xl },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.xl,
    backgroundColor: colors.slate[100],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  emptyTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold as any,
    color: colors.slate[900],
  },
  emptyBody: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[500],
    textAlign: 'center',
    marginTop: 4,
  },
  limitBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    backgroundColor: colors.warning[50],
    borderWidth: 1,
    borderColor: colors.warning[200],
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  limitTextWrap: { flex: 1 },
  limitText: { fontSize: typography.fontSize.sm, color: colors.warning[800] },
  limitLink: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold as any,
    color: colors.warning[800],
    textDecorationLine: 'underline',
    marginTop: 6,
  },
  errorBox: {
    backgroundColor: colors.error[50],
    borderWidth: 1,
    borderColor: colors.error[200],
    borderRadius: borderRadius.lg,
    padding: spacing.md,
  },
  errorBoxText: { fontSize: typography.fontSize.sm, color: colors.error[700] },
  disabled: { opacity: 0.5 },
});

import React, { useState, useEffect } from 'react';
import {
  Modal as RNModal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { X, Calendar, FileText, Sparkles, AlertTriangle, CalendarClock } from 'lucide-react-native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { borderRadius, spacing } from '../../theme/spacing';
import {
  PRE_NOTICE_PRESETS,
  MAX_PRE_NOTICE_ENTRIES,
  MAX_PRE_NOTICE_DAYS,
  normalizePreNotice,
  validateDueDate,
  describePreNotice,
  suggestedPreNoticeFor,
} from '../../lib/obligationScheduling';
import type { Obligation } from '../../lib/obligationsApi';

interface ObligationReminderModalProps {
  obligation: Obligation | null;
  /** Accepting a suggestion vs. editing a reminder that already exists. */
  mode: 'accept' | 'edit';
  onClose: () => void;
  onSubmit: (dueDate: string, preNoticeDays: number[]) => Promise<void>;
}

function presetLabel(days: number): string {
  if (days === 0) return 'On the day';
  return `${days} day${days === 1 ? '' : 's'} before`;
}

/**
 * Turns an action item into a reminder: the user picks the due date and which lead times
 * to be nudged at.
 *
 * The date is always the user's to set. An AI-suggested date only ever pre-fills the
 * field, flagged as a suggestion — nothing the model produced schedules a notification
 * on its own.
 *
 * Date entry is a masked YYYY-MM-DD TextInput rather than a native picker: the app has
 * no datetimepicker dependency, and adding one would force a new native build. This
 * matches the existing convention in `app/upload.tsx`. Quick-offset chips cover the
 * common cases so most users never type a date at all.
 */
export default function ObligationReminderModal({
  obligation, mode, onClose, onSubmit,
}: ObligationReminderModalProps) {
  const [dueDate, setDueDate] = useState('');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [customDays, setCustomDays] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset whenever a different obligation is opened.
  useEffect(() => {
    if (!obligation) return;
    setDueDate(obligation.due_date || obligation.suggested_due_date || '');
    setSelected(
      new Set(
        obligation.pre_notice_days?.length && mode === 'edit'
          ? obligation.pre_notice_days
          : suggestedPreNoticeFor(obligation.obligation_type),
      ),
    );
    setCustomDays('');
    setError(null);
  }, [obligation, mode]);

  if (!obligation) return null;

  const today = new Date();
  const dateCheck = validateDueDate(dueDate, today);
  const noticeCheck = normalizePreNotice([...selected]);
  const canSubmit = dateCheck.ok && noticeCheck.ok && !submitting;

  const showSuggestedHint =
    mode === 'accept' && !!obligation.suggested_due_date && dueDate === obligation.suggested_due_date;

  const toggle = (days: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(days)) next.delete(days);
      else if (next.size < MAX_PRE_NOTICE_ENTRIES) next.add(days);
      return next;
    });
  };

  /** Quick offsets from today, so the common case needs no typing. */
  const setDateFromOffset = (daysFromNow: number) => {
    const target = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + daysFromNow));
    setDueDate(target.toISOString().split('T')[0]);
  };

  const addCustom = () => {
    const parsed = Number(customDays);
    if (!Number.isInteger(parsed) || parsed < 0 || parsed > MAX_PRE_NOTICE_DAYS) {
      setError(`Enter a whole number of days between 0 and ${MAX_PRE_NOTICE_DAYS}`);
      return;
    }
    if (selected.size >= MAX_PRE_NOTICE_ENTRIES && !selected.has(parsed)) {
      setError(`You can pick at most ${MAX_PRE_NOTICE_ENTRIES} reminder times`);
      return;
    }
    setError(null);
    setSelected(prev => new Set(prev).add(parsed));
    setCustomDays('');
  };

  const handleSubmit = async () => {
    if (!dateCheck.ok || !noticeCheck.ok) return;
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(dateCheck.value, noticeCheck.days);
      onClose();
    } catch (err) {
      // Keep the modal open so the user's input survives the failure.
      setError(err instanceof Error ? err.message : 'Could not save this reminder');
    } finally {
      setSubmitting(false);
    }
  };

  const customSelections = [...selected]
    .filter(d => !(PRE_NOTICE_PRESETS as readonly number[]).includes(d))
    .sort((a, b) => b - a);

  return (
    <RNModal visible transparent animationType="fade" onRequestClose={onClose} accessibilityViewIsModal>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />

        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text style={styles.title}>{mode === 'accept' ? 'Add reminder' : 'Edit reminder'}</Text>
              <Text style={styles.subtitle} numberOfLines={1}>{obligation.title}</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={8} accessibilityRole="button" accessibilityLabel="Close">
              <X size={20} color={colors.slate[400]} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} keyboardShouldPersistTaps="handled">
            {/* Source document — the tie back to where this came from */}
            <View style={styles.sourceRow}>
              <FileText size={16} color={colors.slate[400]} />
              <Text style={styles.sourceText} numberOfLines={2}>
                From <Text style={styles.sourceName}>{obligation.document_name}</Text>
              </Text>
            </View>

            {!!obligation.description && (
              <Text style={styles.description}>{obligation.description}</Text>
            )}

            {!!obligation.source_excerpt && (
              <View style={styles.quoteWrap}>
                <Text style={styles.quote}>{obligation.source_excerpt}</Text>
              </View>
            )}

            {/* Due date */}
            <Text style={styles.label}>Due date</Text>

            {!!obligation.suggested_due_text && !obligation.suggested_due_date && (
              <View style={styles.hintBox}>
                <Text style={styles.hintText}>
                  The document says this is due <Text style={styles.hintStrong}>{obligation.suggested_due_text}</Text>.
                  Work out the date and set it below.
                </Text>
              </View>
            )}

            <View style={styles.dateInputWrap}>
              <Calendar size={18} color={colors.slate[400]} />
              <TextInput
                style={styles.dateInput}
                value={dueDate}
                onChangeText={setDueDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.slate[400]}
                keyboardType="numbers-and-punctuation"
                autoCapitalize="none"
                autoCorrect={false}
                accessibilityLabel="Due date"
              />
            </View>

            <View style={styles.chipRow}>
              {[
                { label: 'In a week', days: 7 },
                { label: 'In a month', days: 30 },
                { label: 'In 3 months', days: 90 },
                { label: 'In a year', days: 365 },
              ].map(preset => (
                <TouchableOpacity
                  key={preset.days}
                  style={styles.offsetChip}
                  onPress={() => setDateFromOffset(preset.days)}
                >
                  <Text style={styles.offsetChipText}>{preset.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {showSuggestedHint && (
              <View style={styles.inlineNote}>
                <Sparkles size={13} color={colors.warning[700]} />
                <Text style={styles.inlineNoteText}>Suggested from the document — check it before saving.</Text>
              </View>
            )}
            {!dateCheck.ok && dueDate !== '' && (
              <Text style={styles.errorText}>{dateCheck.error}</Text>
            )}
            {dateCheck.ok && dateCheck.isPast && (
              <View style={styles.inlineNote}>
                <AlertTriangle size={13} color={colors.warning[700]} />
                <Text style={styles.inlineNoteText}>
                  That date has passed — we'll flag this as overdue instead of reminding you beforehand.
                </Text>
              </View>
            )}

            {/* Pre-notice ladder */}
            <Text style={[styles.label, { marginTop: spacing.xl }]}>Remind me</Text>
            <View style={styles.chipRow}>
              {PRE_NOTICE_PRESETS.map(days => {
                const active = selected.has(days);
                return (
                  <TouchableOpacity
                    key={days}
                    onPress={() => toggle(days)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    style={[styles.noticeChip, active && styles.noticeChipActive]}
                  >
                    <Text style={[styles.noticeChipText, active && styles.noticeChipTextActive]}>
                      {presetLabel(days)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
              {customSelections.map(days => (
                <TouchableOpacity
                  key={days}
                  onPress={() => toggle(days)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: true }}
                  style={[styles.noticeChip, styles.noticeChipActive]}
                >
                  <Text style={[styles.noticeChipText, styles.noticeChipTextActive]}>{presetLabel(days)}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.customRow}>
              <TextInput
                style={styles.customInput}
                value={customDays}
                onChangeText={setCustomDays}
                placeholder="Custom days"
                placeholderTextColor={colors.slate[400]}
                keyboardType="number-pad"
                accessibilityLabel="Custom reminder days before"
              />
              <TouchableOpacity
                onPress={addCustom}
                disabled={!customDays}
                style={[styles.addButton, !customDays && styles.disabled]}
              >
                <Text style={styles.addButtonText}>Add</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.summaryRow}>
              <CalendarClock size={16} color={colors.slate[400]} />
              <Text style={noticeCheck.ok ? styles.summaryText : styles.errorText}>
                {noticeCheck.ok
                  ? `We'll remind you ${describePreNotice(noticeCheck.days)}.`
                  : noticeCheck.error}
              </Text>
            </View>

            {!!error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorBoxText}>{error}</Text>
              </View>
            )}
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity onPress={onClose} style={styles.cancelButton}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={!canSubmit}
              style={[styles.submitButton, !canSubmit && styles.disabled]}
            >
              {submitting
                ? <ActivityIndicator size="small" color={colors.white} />
                : <Text style={styles.submitText}>{mode === 'accept' ? 'Add reminder' : 'Save changes'}</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </RNModal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(15, 23, 42, 0.6)' },
  container: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.xl,
    width: '90%',
    maxWidth: 420,
    maxHeight: '85%',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate[200],
    gap: spacing.md,
  },
  headerText: { flex: 1 },
  title: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold as any,
    color: colors.slate[900],
  },
  subtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[500],
    marginTop: 2,
  },
  body: { paddingHorizontal: spacing.xl, paddingVertical: spacing.lg },
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.slate[50],
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  sourceText: { flex: 1, fontSize: typography.fontSize.sm, color: colors.slate[600] },
  sourceName: { fontWeight: typography.fontWeight.semibold as any, color: colors.slate[800] },
  description: { fontSize: typography.fontSize.sm, color: colors.slate[600], marginTop: spacing.md },
  quoteWrap: {
    marginTop: spacing.md,
    borderLeftWidth: 2,
    borderLeftColor: colors.slate[200],
    paddingLeft: spacing.md,
  },
  quote: { fontSize: typography.fontSize.xs, color: colors.slate[500], fontStyle: 'italic' },
  label: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold as any,
    color: colors.slate[700],
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  hintBox: {
    backgroundColor: colors.warning[50],
    borderWidth: 1,
    borderColor: colors.warning[200],
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  hintText: { fontSize: typography.fontSize.xs, color: colors.warning[700] },
  hintStrong: { fontWeight: typography.fontWeight.semibold as any },
  dateInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.slate[300],
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  dateInput: { flex: 1, fontSize: typography.fontSize.base, color: colors.slate[900], paddingVertical: 4 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  offsetChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: borderRadius.md,
    backgroundColor: colors.slate[100],
  },
  offsetChipText: { fontSize: typography.fontSize.xs, color: colors.slate[600], fontWeight: typography.fontWeight.medium as any },
  noticeChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.slate[300],
    backgroundColor: colors.white,
  },
  noticeChipActive: { backgroundColor: colors.primary[100], borderColor: colors.primary[300] },
  noticeChipText: { fontSize: typography.fontSize.sm, color: colors.slate[600], fontWeight: typography.fontWeight.medium as any },
  noticeChipTextActive: { color: colors.primary[700] },
  customRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md },
  customInput: {
    width: 130,
    borderWidth: 1,
    borderColor: colors.slate[300],
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: typography.fontSize.sm,
    color: colors.slate[900],
  },
  addButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderWidth: 1,
    borderColor: colors.slate[300],
    borderRadius: borderRadius.md,
  },
  addButtonText: { fontSize: typography.fontSize.sm, color: colors.slate[600], fontWeight: typography.fontWeight.medium as any },
  summaryRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginTop: spacing.md },
  summaryText: { flex: 1, fontSize: typography.fontSize.sm, color: colors.slate[600] },
  inlineNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: spacing.sm },
  inlineNoteText: { flex: 1, fontSize: typography.fontSize.xs, color: colors.warning[700] },
  errorText: { fontSize: typography.fontSize.xs, color: colors.error[600], marginTop: spacing.sm },
  errorBox: {
    marginTop: spacing.md,
    backgroundColor: colors.error[50],
    borderWidth: 1,
    borderColor: colors.error[200],
    borderRadius: borderRadius.lg,
    padding: spacing.md,
  },
  errorBoxText: { fontSize: typography.fontSize.sm, color: colors.error[700] },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.slate[200],
  },
  cancelButton: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  cancelText: { fontSize: typography.fontSize.sm, color: colors.slate[600], fontWeight: typography.fontWeight.medium as any },
  submitButton: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm + 4,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.primary[600],
    minWidth: 130,
    alignItems: 'center',
  },
  submitText: { fontSize: typography.fontSize.sm, color: colors.white, fontWeight: typography.fontWeight.semibold as any },
  disabled: { opacity: 0.5 },
});

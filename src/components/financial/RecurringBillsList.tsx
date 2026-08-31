import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, Platform } from 'react-native';
import { Receipt, CalendarClock, Plus, X as XIcon, Trash2 } from 'lucide-react-native';
import type { RecurringBill } from '../../lib/financialApi';
import {
  getTagOptions,
  addIncomeStreamTag,
  removeIncomeStreamTag,
  dismissRecurringBill,
} from '../../lib/financialApi';
import CollapsibleSection from './CollapsibleSection';
import { tooShortForRhythm, toYmd, type Period } from '../../lib/reportingPeriod';
import TagPicker from '../ui/TagPicker';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing, borderRadius } from '../../theme/spacing';

interface RecurringBillsListProps {
  bills: RecurringBill[];
  /** The window every section on the page is reporting. */
  period: Period;
  loading: boolean;
  onChanged: () => void;
}

const formatCurrency = (amount: number): string =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** An expected payment whose date has passed without it arriving. */
const isOverdue = (nextExpected: string): boolean => nextExpected < toYmd(new Date());

/** How each rhythm is said aloud, matching the web list word for word. */
const EVERY: Record<string, string> = {
  weekly: 'every week', biweekly: 'every 2 weeks', monthly: 'monthly',
  bimonthly: 'every 2 months', quarterly: 'quarterly',
};

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();

// Derive auto-tags from bill properties (frequency + category)
function getAutoTags(bill: RecurringBill): string[] {
  const tags: string[] = [];
  if (bill.frequency) tags.push(capitalize(bill.frequency));
  if (bill.category) tags.push(bill.category);
  return [...new Set(tags)];
}

export default function RecurringBillsList({ bills, period, loading, onChanged }: RecurringBillsListProps) {
  const [billTagOptions, setBillTagOptions] = useState<string[]>([]);
  const [localTags, setLocalTags] = useState<Record<string, string[]>>({});
  const [materialized, setMaterialized] = useState<Set<string>>(new Set());
  const [pickerStem, setPickerStem] = useState<string | null>(null);
  const [hidden, setHidden] = useState<Set<string>>(new Set());


  useEffect(() => {
    getTagOptions().then(opts => setBillTagOptions(opts.bill_tags || [])).catch(() => {});
  }, []);

  // Initialize tags: use user_tags if present, otherwise auto-derive from frequency + category
  useEffect(() => {
    const tags: Record<string, string[]> = {};
    const alreadySaved = new Set<string>();
    for (const b of bills) {
      if (b.merchant_stem) {
        const userTags = b.user_tags || [];
        if (userTags.length > 0) {
          tags[b.merchant_stem] = [...userTags];
          alreadySaved.add(b.merchant_stem);
        } else {
          tags[b.merchant_stem] = getAutoTags(b);
        }
      }
    }
    setLocalTags(tags);
    setMaterialized(alreadySaved);
  }, [bills]);

  // Optimistically hide a removed bill until the parent's refresh drops it from `bills`.
  const visibleBills = bills.filter(b => !hidden.has(b.merchant_stem));

  // Once dates have been picked the section stays on screen even when empty, otherwise choosing a
  // window with no bills would take the control needed to choose another away with it.
  if (loading) return null;

  const total = visibleBills.reduce((sum, b) => sum + b.monthly_amount, 0);

  const applyDismiss = async (bill: RecurringBill) => {
    const stem = bill.merchant_stem;
    setHidden(prev => new Set(prev).add(stem));
    try {
      await dismissRecurringBill(stem);
      onChanged();
    } catch {
      setHidden(prev => { const n = new Set(prev); n.delete(stem); return n; });
    }
  };

  const handleRemoveBill = (bill: RecurringBill) => {
    Alert.alert(
      'Remove recurring bill',
      `Remove "${bill.name}" from recurring bills? Your spending totals won't change.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => applyDismiss(bill) },
      ],
    );
  };

  // Persist auto-derived tags to DB so future add/remove works correctly
  const ensureMaterialized = async (stem: string) => {
    if (materialized.has(stem)) return;
    const currentTags = localTags[stem] || [];
    for (const tag of currentTags) {
      await addIncomeStreamTag(stem, tag);
    }
    setMaterialized(prev => new Set(prev).add(stem));
  };

  const handleAddTag = async (bill: RecurringBill, tag: string) => {
    const stem = bill.merchant_stem;
    setLocalTags(prev => ({ ...prev, [stem]: [...(prev[stem] || []), tag] }));
    setPickerStem(null);
    try {
      await ensureMaterialized(stem);
      await addIncomeStreamTag(stem, tag);
    } catch {
      setLocalTags(prev => ({ ...prev, [stem]: (prev[stem] || []).filter(t => t !== tag) }));
    }
  };

  const handleRemoveTag = async (bill: RecurringBill, tag: string) => {
    const stem = bill.merchant_stem;
    const remaining = (localTags[stem] || []).filter(t => t !== tag);
    setLocalTags(prev => ({ ...prev, [stem]: remaining }));
    try {
      if (!materialized.has(stem)) {
        // Materialize only the remaining tags (skips the removed one)
        for (const t of remaining) {
          await addIncomeStreamTag(stem, t);
        }
        setMaterialized(prev => new Set(prev).add(stem));
      } else {
        await removeIncomeStreamTag(stem, tag);
      }
    } catch {
      console.error('Failed to remove bill tag');
    }
  };

  const pickerBill = bills.find(b => b.merchant_stem === pickerStem);

  return (
    <CollapsibleSection
      icon={<Receipt size={18} color={colors.primary[600]} strokeWidth={2} />}
      title="Recurring Bills"
      trailing={<Text style={styles.total}>{formatCurrency(total)}/mo</Text>}
    >
      {/* A window shorter than two cycles cannot evidence a monthly rhythm — one charge has
          nothing to recur against. An empty list reads as lost data unless the period is named
          as the reason. */}
      {!visibleBills.length && (
        <Text style={styles.rangeEmpty}>
          {tooShortForRhythm(period)
            ? `A bill has to be paid more than once to show a rhythm, and ${period.label.toLowerCase()} is too short for a monthly one to repeat. Choose a longer period to see bills.`
            : 'No bill was paid more than once in this period.'}
        </Text>
      )}

      <View style={styles.list}>
        {visibleBills.slice(0, 10).map((bill, i) => {
          const stem = bill.merchant_stem || `bill-${i}`;
          const tags = localTags[stem] || [];

          return (
            <View key={`${bill.name}-${i}`} style={styles.row}>
              <View style={styles.billInfo}>
                <Text style={styles.billName} numberOfLines={1}>{bill.name}</Text>
                {/* The rhythm as charged, how many payments it was read from, and when it lands
                    next — not a rate no month matches. */}
                {(bill.frequency || bill.next_expected) && (
                  <View style={styles.nextDate}>
                    <CalendarClock size={12} color={colors.slate[400]} strokeWidth={2} />
                    <Text style={styles.nextDateText}>
                      {EVERY[bill.frequency] ?? bill.frequency}
                      {bill.occurrences > 0
                        ? ` · ${bill.occurrences} payment${bill.occurrences === 1 ? '' : 's'}`
                        : ''}
                    </Text>
                    {bill.next_expected && (
                      <Text style={isOverdue(bill.next_expected) ? styles.overdueText : styles.nextDateText}>
                        {isOverdue(bill.next_expected)
                          // The date came and went with no payment. Still listed, because one
                          // missed cycle is not proof it ended — but "Next" would be untrue.
                          ? ` · Expected ${formatDate(bill.next_expected)}, not seen`
                          : ` · Next: ${formatDate(bill.next_expected)}`}
                      </Text>
                    )}
                  </View>
                )}
                {/* Tags row — frequency + category auto-derived, plus user tags */}
                <View style={styles.tagRow}>
                  {tags.map(tag => (
                    <TouchableOpacity
                      key={tag}
                      onPress={() => handleRemoveTag(bill, tag)}
                    >
                      <View style={styles.tagInner}>
                        <Text style={styles.tagText}>{tag}</Text>
                        <XIcon size={10} color={colors.warning[600]} />
                      </View>
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity
                    onPress={() => setPickerStem(stem)}
                    style={styles.addButton}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  >
                    <Plus size={12} color={colors.slate[400]} />
                  </TouchableOpacity>
                </View>
              </View>
              <View style={styles.rightCol}>
                <Text style={styles.billAmount}>{formatCurrency(bill.amount)}</Text>
                <TouchableOpacity
                  onPress={() => handleRemoveBill(bill)}
                  style={styles.removeButton}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Trash2 size={14} color={colors.slate[300]} />
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
      </View>

      <TagPicker
        visible={!!pickerStem}
        title="Label Bill"
        options={billTagOptions}
        existingTags={pickerStem ? (localTags[pickerStem] || []) : []}
        onSelect={(tag) => pickerBill && handleAddTag(pickerBill, tag)}
        onClose={() => setPickerStem(null)}
      />
    </CollapsibleSection>
  );
}

const styles = StyleSheet.create({
  total: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary[600],
  },
  list: {
    gap: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate[100],
  },
  billInfo: {
    flex: 1,
    marginRight: spacing.md,
    gap: spacing.xs,
  },
  billName: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.slate[800],
  },
  nextDate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  nextDateText: {
    fontSize: typography.fontSize.xs,
    color: colors.slate[400],
  },
  overdueText: {
    fontSize: typography.fontSize.xs,
    color: colors.warning[600],
  },
  rangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  rangeLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.slate[500],
  },
  rangeInput: {
    fontSize: typography.fontSize.xs,
    color: colors.slate[700],
    borderWidth: 1,
    borderColor: colors.slate[200],
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    minWidth: 116,
    backgroundColor: colors.white,
  },
  rangeReset: {
    fontSize: typography.fontSize.xs,
    color: colors.primary[600],
    fontWeight: typography.fontWeight.medium,
  },
  rangeLoading: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  rangeEmpty: {
    fontSize: typography.fontSize.xs,
    color: colors.slate[500],
    paddingVertical: spacing.md,
  },
  rightCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: 2,
  },
  billAmount: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.slate[900],
  },
  removeButton: {
    padding: 4,
  },
  tagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  tagInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    backgroundColor: colors.warning[50],
    borderColor: colors.warning[200],
  },
  tagText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    color: colors.warning[700],
  },
  addButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.slate[50],
  },
});

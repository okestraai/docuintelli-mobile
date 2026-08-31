import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { PieChart, ChevronDown, ChevronRight, Plus, X as XIcon } from 'lucide-react-native';
import type { CategoryBreakdown, TransactionDetail, TransactionClassification } from '../../lib/financialApi';
import {
  getTransactionsByCategory,
  getSpendingByCategory,
  getTagOptions,
  addTransactionTag,
  removeTransactionTag,
  setTransactionClassification,
  removeTransactionClassification,
} from '../../lib/financialApi';
import CollapsibleSection from './CollapsibleSection';
import TagPicker from '../ui/TagPicker';
import { buildSpendingPeriods, findPeriod, DEFAULT_PERIOD_ID } from '../../lib/spendingPeriods';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing, borderRadius } from '../../theme/spacing';

interface SpendingBreakdownProps {
  categories: CategoryBreakdown[];
  /** The months that have data (YYYY-MM), from summary.monthly_averages — the years to offer. */
  monthKeys: string[];
}

const CATEGORY_COLORS = [
  colors.primary[500],
  colors.teal[500],
  colors.info[500],
  colors.warning[500],
  colors.error[500],
  colors.slate[400],
  '#8b5cf6',
  '#ec4899',
  '#f97316',
  '#06b6d4',
];

const formatCurrency = (amount: number): string =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);

export default function SpendingBreakdown({ categories, monthKeys }: SpendingBreakdownProps) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [txnCache, setTxnCache] = useState<Record<string, TransactionDetail[]>>({});
  const [tagOptions, setTagOptions] = useState<string[]>([]);
  const [pickerTxnId, setPickerTxnId] = useState<string | null>(null);
  const [classifyTxnId, setClassifyTxnId] = useState<string | null>(null);

  const periods = useMemo(() => buildSpendingPeriods(monthKeys), [monthKeys]);
  const [periodId, setPeriodId] = useState(DEFAULT_PERIOD_ID);
  const [periodPickerOpen, setPeriodPickerOpen] = useState(false);
  const period = findPeriod(periods, periodId);
  // The default period is the summary's own window, so the untouched section renders the figures
  // already fetched rather than asking the server for the same answer again.
  const [filtered, setFiltered] = useState<CategoryBreakdown[] | null>(null);
  const [loadingPeriod, setLoadingPeriod] = useState(false);
  const [periodError, setPeriodError] = useState<string | null>(null);

  useEffect(() => {
    getTagOptions().then(opts => setTagOptions(opts.transaction_tags)).catch(() => {});
  }, []);

  useEffect(() => {
    if (periodId === DEFAULT_PERIOD_ID) {
      setFiltered(null);
      setPeriodError(null);
      return;
    }
    let cancelled = false;
    setLoadingPeriod(true);
    setPeriodError(null);
    getSpendingByCategory({ start: period.start, end: period.end })
      .then(res => { if (!cancelled) setFiltered(res.categories); })
      .catch(() => {
        if (cancelled) return;
        setFiltered([]);
        setPeriodError('Could not load spending for this period.');
      })
      .finally(() => { if (!cancelled) setLoadingPeriod(false); });
    return () => { cancelled = true; };
  }, [periodId, period.start, period.end]);

  const shown = filtered ?? categories;

  // Once a period has been picked the section stays on screen even when that period is empty,
  // otherwise choosing a month before the accounts were linked would make the whole card vanish
  // along with the control needed to choose another.
  if (!categories.length && !filtered && !loadingPeriod) return null;

  const top = shown.slice(0, 8);
  const maxPercentage = top.length ? Math.max(...top.map((c) => c.percentage)) : 0;

  const handleCategoryPress = async (cat: CategoryBreakdown) => {
    const key = cat.category_key || cat.category;
    if (expandedKey === key) {
      setExpandedKey(null);
      return;
    }
    setExpandedKey(key);
    // Keyed by period as well as category: the rows below a category have to be the ones the
    // category total was computed from, so a cached year must not reappear under a month.
    const cacheKey = `${periodId}:${key}`;
    if (txnCache[cacheKey]) return;
    setLoadingKey(key);
    try {
      const txns = await getTransactionsByCategory(key, { start: period.start, end: period.end });
      setTxnCache(prev => ({ ...prev, [cacheKey]: txns }));
    } catch {
      // ignore
    } finally {
      setLoadingKey(null);
    }
  };

  const handleAddTag = async (txn: TransactionDetail, tag: string) => {
    setTxnCache(prev => {
      const updated = { ...prev };
      for (const key in updated) {
        updated[key] = updated[key].map(t =>
          t.transaction_id === txn.transaction_id
            ? { ...t, user_tags: [...(t.user_tags || []), tag] }
            : t
        );
      }
      return updated;
    });
    setPickerTxnId(null);
    try {
      await addTransactionTag(txn.transaction_id, tag);
    } catch {
      // Revert
      setTxnCache(prev => {
        const updated = { ...prev };
        for (const key in updated) {
          updated[key] = updated[key].map(t =>
            t.transaction_id === txn.transaction_id
              ? { ...t, user_tags: (t.user_tags || []).filter(tt => tt !== tag) }
              : t
          );
        }
        return updated;
      });
    }
  };

  const handleRemoveTag = async (txn: TransactionDetail, tag: string) => {
    setTxnCache(prev => {
      const updated = { ...prev };
      for (const key in updated) {
        updated[key] = updated[key].map(t =>
          t.transaction_id === txn.transaction_id
            ? { ...t, user_tags: (t.user_tags || []).filter(tt => tt !== tag) }
            : t
        );
      }
      return updated;
    });
    try {
      await removeTransactionTag(txn.transaction_id, tag);
    } catch { /* best effort */ }
  };

  const CLASSIFICATION_OPTIONS: { value: TransactionClassification; label: string; color: string; bg: string; border: string }[] = [
    { value: 'expense', label: 'Expense', color: colors.error[600], bg: colors.error[50], border: colors.error[200] },
    { value: 'income', label: 'Income', color: colors.primary[600], bg: colors.primary[50], border: colors.primary[200] },
    { value: 'transfer', label: 'Transfer', color: colors.info[600], bg: colors.info[50], border: colors.info[200] },
    { value: 'ignore', label: 'Ignore', color: colors.slate[500], bg: colors.slate[50], border: colors.slate[200] },
  ];

  const handleClassify = async (txn: TransactionDetail, classification: TransactionClassification) => {
    const prev = txn.classification;
    // Optimistic update
    setTxnCache(cache => {
      const updated = { ...cache };
      for (const key in updated) {
        updated[key] = updated[key].map(t =>
          t.transaction_id === txn.transaction_id ? { ...t, classification } : t
        );
      }
      return updated;
    });
    setClassifyTxnId(null);
    try {
      await setTransactionClassification(txn.transaction_id, classification);
    } catch {
      // Revert
      setTxnCache(cache => {
        const updated = { ...cache };
        for (const key in updated) {
          updated[key] = updated[key].map(t =>
            t.transaction_id === txn.transaction_id ? { ...t, classification: prev } : t
          );
        }
        return updated;
      });
    }
  };

  const handleResetClassification = async (txn: TransactionDetail) => {
    const prev = txn.classification;
    setTxnCache(cache => {
      const updated = { ...cache };
      for (const key in updated) {
        updated[key] = updated[key].map(t =>
          t.transaction_id === txn.transaction_id ? { ...t, classification: undefined } : t
        );
      }
      return updated;
    });
    setClassifyTxnId(null);
    try {
      await removeTransactionClassification(txn.transaction_id);
    } catch {
      setTxnCache(cache => {
        const updated = { ...cache };
        for (const key in updated) {
          updated[key] = updated[key].map(t =>
            t.transaction_id === txn.transaction_id ? { ...t, classification: prev } : t
          );
        }
        return updated;
      });
    }
  };

  // Find transaction for classify picker
  let classifyTxn: TransactionDetail | undefined;
  if (classifyTxnId) {
    for (const key in txnCache) {
      classifyTxn = txnCache[key].find(t => t.transaction_id === classifyTxnId);
      if (classifyTxn) break;
    }
  }

  // Find transaction for picker
  let pickerTxn: TransactionDetail | undefined;
  if (pickerTxnId) {
    for (const key in txnCache) {
      pickerTxn = txnCache[key].find(t => t.transaction_id === pickerTxnId);
      if (pickerTxn) break;
    }
  }

  return (
    <CollapsibleSection
      icon={<PieChart size={18} color={colors.primary[600]} strokeWidth={2} />}
      title="Spending Breakdown"
    >
      <TouchableOpacity
        onPress={() => setPeriodPickerOpen(true)}
        activeOpacity={0.7}
        style={styles.periodButton}
      >
        <Text style={styles.periodButtonText}>{period.label}</Text>
        <ChevronDown size={14} color={colors.slate[500]} />
      </TouchableOpacity>

      {loadingPeriod && (
        <View style={styles.periodLoading}>
          <ActivityIndicator size="small" color={colors.primary[500]} />
        </View>
      )}

      {!loadingPeriod && top.length === 0 && (
        <Text style={styles.periodEmpty}>
          {periodError || `No spending recorded in ${period.label.toLowerCase()}.`}
        </Text>
      )}

      <View style={styles.list}>
        {!loadingPeriod && top.map((cat, i) => {
          const key = cat.category_key || cat.category;
          const barWidth = maxPercentage > 0 ? (cat.percentage / maxPercentage) * 100 : 0;
          const barColor = CATEGORY_COLORS[i % CATEGORY_COLORS.length];
          const isExpanded = expandedKey === key;
          const isLoading = loadingKey === key;
          const txns = txnCache[`${periodId}:${key}`];

          return (
            <View key={cat.category}>
              <TouchableOpacity
                onPress={() => handleCategoryPress(cat)}
                activeOpacity={0.7}
                style={styles.row}
              >
                <View style={styles.labelRow}>
                  {isExpanded
                    ? <ChevronDown size={14} color={colors.primary[600]} />
                    : <ChevronRight size={14} color={colors.slate[400]} />}
                  <View style={[styles.dot, { backgroundColor: barColor }]} />
                  <Text style={styles.category} numberOfLines={1}>{cat.category}</Text>
                  <Text style={styles.amountLabel}>{formatCurrency(cat.monthly_average)}/mo</Text>
                </View>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { width: `${barWidth}%`, backgroundColor: barColor }]} />
                </View>
                <View style={styles.statRow}>
                  <Text style={styles.statText}>{cat.transaction_count} txns</Text>
                  <Text style={styles.percentage}>{Math.round(cat.percentage)}%</Text>
                </View>
              </TouchableOpacity>

              {isExpanded && (
                <View style={styles.txnContainer}>
                  {isLoading ? (
                    <ActivityIndicator size="small" color={colors.primary[500]} style={styles.loader} />
                  ) : txns && txns.length > 0 ? (
                    txns.map((txn) => {
                      const txnTags = txn.user_tags || [];
                      return (
                        <View key={txn.transaction_id} style={styles.txnRow}>
                          <View style={styles.txnInfo}>
                            <Text style={styles.txnName} numberOfLines={1}>
                              {txn.merchant_name || txn.name}
                            </Text>
                            <Text style={styles.txnDate}>
                              {new Date(txn.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </Text>
                          </View>
                          <Text style={styles.txnAmount}>{formatCurrency(txn.amount)}</Text>
                          {/* Classification + Tags */}
                          <View style={styles.txnTagRow}>
                            {/* Classification chip */}
                            {(() => {
                              const effective = txn.classification || txn.heuristic_classification || 'expense';
                              const isOverridden = !!txn.classification;
                              const opt = CLASSIFICATION_OPTIONS.find(o => o.value === effective) || CLASSIFICATION_OPTIONS[0];
                              return (
                                <TouchableOpacity
                                  onPress={() => setClassifyTxnId(txn.transaction_id)}
                                  style={[styles.classChip, { backgroundColor: opt.bg, borderColor: opt.border }, isOverridden && styles.classChipOverridden]}
                                >
                                  <Text style={[styles.classChipText, { color: opt.color }]}>
                                    {opt.label}{isOverridden ? ' ✓' : ''}
                                  </Text>
                                </TouchableOpacity>
                              );
                            })()}
                            {txnTags.map(tag => (
                              <TouchableOpacity
                                key={tag}
                                onPress={() => handleRemoveTag(txn, tag)}
                                style={styles.txnTag}
                              >
                                <Text style={styles.txnTagText}>{tag}</Text>
                                <XIcon size={8} color={colors.primary[600]} />
                              </TouchableOpacity>
                            ))}
                            <TouchableOpacity
                              onPress={() => setPickerTxnId(txn.transaction_id)}
                              style={styles.addTagBtn}
                              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                            >
                              <Plus size={10} color={colors.slate[400]} />
                            </TouchableOpacity>
                          </View>
                        </View>
                      );
                    })
                  ) : (
                    <Text style={styles.emptyTxn}>No transactions found</Text>
                  )}
                </View>
              )}
            </View>
          );
        })}
      </View>

      {/* Period picker. TagPicker is already used here as a generic option sheet. */}
      <TagPicker
        visible={periodPickerOpen}
        title="Spending Period"
        options={periods.map(p => p.label)}
        existingTags={[]}
        onSelect={(label) => {
          const picked = periods.find(p => p.label === label);
          if (picked) setPeriodId(picked.id);
          setPeriodPickerOpen(false);
        }}
        onClose={() => setPeriodPickerOpen(false)}
      />

      <TagPicker
        visible={!!pickerTxnId}
        title="Tag Transaction"
        options={tagOptions}
        existingTags={pickerTxn?.user_tags || []}
        onSelect={(tag) => pickerTxn && handleAddTag(pickerTxn, tag)}
        onClose={() => setPickerTxnId(null)}
      />

      {/* Classification picker modal */}
      {(() => {
        const effectiveCls = classifyTxn?.classification || classifyTxn?.heuristic_classification || 'expense';
        const isOverridden = !!classifyTxn?.classification;
        const options = CLASSIFICATION_OPTIONS.filter(o => o.value !== effectiveCls).map(o => o.label);
        if (isOverridden) options.push('Reset to auto');
        return (
          <TagPicker
            visible={!!classifyTxnId}
            title={isOverridden ? 'Change Classification' : 'Classify Transaction'}
            options={options}
            existingTags={[]}
            onSelect={(label) => {
              if (label === 'Reset to auto') {
                if (classifyTxn) handleResetClassification(classifyTxn);
              } else {
                const opt = CLASSIFICATION_OPTIONS.find(o => o.label === label);
                if (opt && classifyTxn) handleClassify(classifyTxn, opt.value);
              }
            }}
            onClose={() => setClassifyTxnId(null)}
          />
        );
      })()}
    </CollapsibleSection>
  );
}

const styles = StyleSheet.create({
  periodButton: {
    alignSelf: 'flex-end',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.slate[200],
    borderRadius: borderRadius.md,
    backgroundColor: colors.white,
  },
  periodButtonText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    color: colors.slate[700],
  },
  periodLoading: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  periodEmpty: {
    fontSize: typography.fontSize.xs,
    color: colors.slate[500],
    paddingVertical: spacing.md,
  },
  list: {
    gap: spacing.sm,
  },
  row: {
    gap: spacing.xs,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  category: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.slate[700],
  },
  amountLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.slate[500],
  },
  barTrack: {
    height: 6,
    backgroundColor: colors.slate[100],
    borderRadius: 3,
    overflow: 'hidden',
  },
  barFill: {
    height: 6,
    borderRadius: 3,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statText: {
    fontSize: typography.fontSize.xs,
    color: colors.slate[400],
  },
  percentage: {
    fontSize: typography.fontSize.xs,
    color: colors.slate[400],
    textAlign: 'right',
  },
  txnContainer: {
    marginLeft: spacing.lg,
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
    backgroundColor: colors.slate[50],
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.slate[100],
    overflow: 'hidden',
  },
  loader: {
    paddingVertical: spacing.md,
  },
  txnRow: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate[100],
  },
  txnInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  txnName: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: colors.slate[700],
    marginRight: spacing.sm,
  },
  txnDate: {
    fontSize: typography.fontSize.xs,
    color: colors.slate[400],
  },
  txnAmount: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.slate[900],
    textAlign: 'right',
    marginTop: 2,
  },
  txnTagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 4,
    marginTop: spacing.xs,
  },
  txnTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: colors.primary[50],
    borderColor: colors.primary[200],
    borderWidth: 1,
    borderRadius: borderRadius.sm,
  },
  txnTagText: {
    fontSize: 10,
    fontWeight: typography.fontWeight.medium,
    color: colors.primary[700],
  },
  classChip: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderRadius: borderRadius.sm,
  },
  classChipOverridden: {
    borderWidth: 1.5,
  },
  classChipText: {
    fontSize: 10,
    fontWeight: typography.fontWeight.semibold,
  },
  addTagBtn: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.slate[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTxn: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[400],
    textAlign: 'center',
    paddingVertical: spacing.md,
  },
});

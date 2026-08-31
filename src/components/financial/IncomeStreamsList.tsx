import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Banknote, Briefcase, CircleDollarSign, Plus, X as XIcon, Trash2 } from 'lucide-react-native';
import type { InflowSource } from '../../lib/financialApi';
import {
  getTagOptions,
  addIncomeStreamTag,
  removeIncomeStreamTag,
  reclassifyIncomeStream,
} from '../../lib/financialApi';
import CollapsibleSection from './CollapsibleSection';
import Badge from '../ui/Badge';
import TagPicker from '../ui/TagPicker';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing, borderRadius } from '../../theme/spacing';

interface MoneyInListProps {
  sources: InflowSource[];
  /** Months of history these amounts cover. Without it a total is unreadable — monthly? yearly? */
  monthsObserved?: number;
  onChanged: () => void;
}

const periodLabel = (months?: number): string =>
  months === undefined ? 'your history'
  : months < 1.5 ? 'the last month'
  : `the last ${Math.round(months)} months`;

const formatCurrency = (amount: number): string =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);

const formatDay = (iso: string): string =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

/** How a source describes its own rhythm — in its own terms, never converted to a monthly rate. */
function cadenceLabel(s: InflowSource): string {
  if (s.is_recurring && s.frequency && s.average_amount !== undefined) {
    const every: Record<string, string> = {
      weekly: 'every week', biweekly: 'every 2 weeks', monthly: 'monthly',
      bimonthly: 'every 2 months', quarterly: 'quarterly',
    };
    return `${formatCurrency(s.average_amount)} ${every[s.frequency] ?? s.frequency}`;
  }
  if (s.occurrences === 1) return `once, ${formatDay(s.last_date)}`;
  return `${s.occurrences} payments`;
}

export default function MoneyInList({ sources, monthsObserved, onChanged }: MoneyInListProps) {
  const [incomeTagOptions, setIncomeTagOptions] = useState<string[]>([]);
  const [localTags, setLocalTags] = useState<Record<string, string[]>>({});
  const [pickerStem, setPickerStem] = useState<string | null>(null);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [showOneOffs, setShowOneOffs] = useState(false);

  useEffect(() => {
    getTagOptions().then(opts => setIncomeTagOptions(opts.income_tags)).catch(() => {});
  }, []);

  // Tags live per payer, so both rows of a payer that split share them.
  useEffect(() => {
    const tags: Record<string, string[]> = {};
    for (const s of sources) {
      if (s.merchant_stem) {
        const userTags = s.user_tags || [];
        tags[s.merchant_stem] = s.is_salary && !userTags.includes('Salary')
          ? ['Salary', ...userTags]
          : [...userTags];
      }
    }
    setLocalTags(tags);
  }, [sources]);

  // A payer can appear more than once — its recurring rhythm, and whatever fell outside it.
  const visible = sources.filter(s => !hidden.has(s.merchant_stem));

  if (!visible.length) return null;

  const recurring = visible.filter(s => s.is_recurring);
  const oneOffs = visible.filter(s => !s.is_recurring);
  const totalReceived = visible.reduce((sum, s) => sum + s.total_received, 0);
  const oneOffTotal = oneOffs.reduce((sum, s) => sum + s.total_received, 0);

  const applyRemove = async (stream: InflowSource, classification: 'transfer' | 'ignore') => {
    const stem = stream.merchant_stem;
    setHidden(prev => new Set(prev).add(stem));
    try {
      await reclassifyIncomeStream(stem, classification);
      onChanged();
    } catch {
      setHidden(prev => { const n = new Set(prev); n.delete(stem); return n; });
    }
  };

  const handleRemoveStream = (stream: InflowSource) => {
    Alert.alert(
      "This isn't money coming in",
      `Applies to everything from "${stream.source}". What is it?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: "It's a transfer", onPress: () => applyRemove(stream, 'transfer') },
        { text: 'Ignore it', style: 'destructive', onPress: () => applyRemove(stream, 'ignore') },
      ],
    );
  };

  const handleAddTag = async (stream: InflowSource, tag: string) => {
    const stem = stream.merchant_stem;
    setLocalTags(prev => ({ ...prev, [stem]: [...(prev[stem] || []), tag] }));
    setPickerStem(null);
    try {
      const isSalaryOverride = tag === 'Salary' ? true : undefined;
      await addIncomeStreamTag(stem, tag, isSalaryOverride);
    } catch {
      setLocalTags(prev => ({ ...prev, [stem]: (prev[stem] || []).filter(t => t !== tag) }));
    }
  };

  const handleRemoveTag = async (stream: InflowSource, tag: string) => {
    const stem = stream.merchant_stem;
    setLocalTags(prev => ({ ...prev, [stem]: (prev[stem] || []).filter(t => t !== tag) }));
    try {
      if (tag === 'Salary') {
        // Override auto-detection — keep the row with is_auto_salary_override=false
        await addIncomeStreamTag(stem, tag, false);
      } else {
        await removeIncomeStreamTag(stem, tag);
      }
    } catch { /* best effort */ }
  };

  const pickerStream = sources.find(s => s.merchant_stem === pickerStem);

  const renderRow = (stream: InflowSource) => {
          const stem = stream.merchant_stem;
          const tags = localTags[stem] || [];
          const hasSalary = tags.includes('Salary');
          // Derived labels, shown but not editable — they come from the bank's own category.
          const autoTags = [
            ...(stream.kind_tag && stream.kind_tag !== 'Salary' && !tags.includes(stream.kind_tag) ? [stream.kind_tag] : []),
            ...(stream.occurrences === 1 ? ['One-off'] : []),
          ];

          return (
            <View key={`${stream.merchant_stem}::${stream.first_date}`} style={styles.row}>
              <View style={[styles.iconWrap, hasSalary ? styles.salaryIcon : styles.otherIcon]}>
                {hasSalary
                  ? <Briefcase size={14} color={colors.success[600]} strokeWidth={2} />
                  : <CircleDollarSign size={14} color={colors.teal[600]} strokeWidth={2} />}
              </View>
              <View style={styles.info}>
                <Text style={styles.source} numberOfLines={1}>{stream.source}</Text>
                <View style={styles.metaRow}>
                  <Badge label={cadenceLabel(stream)} variant="default" />
                  {autoTags.map(tag => (
                    <View key={`auto-${tag}`} style={[styles.tagInner, styles.autoBadge]}>
                      <Text style={[styles.tagText, styles.autoBadgeText]}>{tag}</Text>
                    </View>
                  ))}
                  {tags.map(tag => (
                    <TouchableOpacity
                      key={tag}
                      onPress={() => handleRemoveTag(stream, tag)}
                      style={styles.tagBadge}
                    >
                      <View style={[styles.tagInner, tag === 'Salary' ? styles.salaryBadge : styles.defaultBadge]}>
                        <Text style={[styles.tagText, tag === 'Salary' ? styles.salaryBadgeText : styles.defaultBadgeText]}>
                          {tag}
                        </Text>
                        <XIcon size={10} color={tag === 'Salary' ? colors.info[600] : colors.teal[600]} />
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
              {/* What arrived, not a rate — this is the column that adds up. */}
              <Text style={styles.amount}>{formatCurrency(stream.total_received)}</Text>
              <TouchableOpacity
                onPress={() => handleRemoveStream(stream)}
                style={styles.removeButton}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Trash2 size={14} color={colors.slate[300]} />
              </TouchableOpacity>
            </View>
          );
  };

  return (
    <CollapsibleSection
      icon={<Banknote size={18} color={colors.success[600]} strokeWidth={2} />}
      title="Money In"
      trailing={<Text style={styles.total}>{formatCurrency(totalReceived)}</Text>}
    >
      <Text style={styles.periodNote}>Amounts received over {periodLabel(monthsObserved)}</Text>
      <View style={styles.list}>{recurring.map(renderRow)}</View>

      {oneOffs.length > 0 && (
        <View>
          <TouchableOpacity onPress={() => setShowOneOffs(v => !v)} style={styles.disclosure}>
            <Text style={styles.disclosureText}>
              {showOneOffs ? 'Hide' : 'Show'} one-off and irregular payments ({oneOffs.length})
            </Text>
            <Text style={styles.disclosureAmount}>{formatCurrency(oneOffTotal)}</Text>
          </TouchableOpacity>
          {showOneOffs && <View style={styles.list}>{oneOffs.map(renderRow)}</View>}
        </View>
      )}

      <TagPicker
        visible={!!pickerStem}
        title="Label this money"
        options={incomeTagOptions}
        existingTags={pickerStem ? (localTags[pickerStem] || []) : []}
        onSelect={(tag) => pickerStream && handleAddTag(pickerStream, tag)}
        onClose={() => setPickerStem(null)}
      />
    </CollapsibleSection>
  );
}

const styles = StyleSheet.create({
  total: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors.success[600],
  },
  list: {
    gap: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate[100],
    gap: spacing.md,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  salaryIcon: {
    backgroundColor: colors.success[50],
  },
  otherIcon: {
    backgroundColor: colors.teal[50],
  },
  info: {
    flex: 1,
    gap: spacing.xs,
  },
  source: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.slate[800],
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  amount: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.slate[900],
  },
  tagBadge: {
    // wrapper for touchable
  },
  tagInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.md,
    borderWidth: 1,
  },
  salaryBadge: {
    backgroundColor: colors.info[50],
    borderColor: colors.info[200],
  },
  defaultBadge: {
    backgroundColor: colors.teal[50],
    borderColor: colors.teal[200],
  },
  tagText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
  },
  salaryBadgeText: {
    color: colors.info[700],
  },
  defaultBadgeText: {
    color: colors.teal[700],
  },
  addButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.slate[50],
  },
  removeButton: {
    padding: 4,
  },
  // Derived from the bank's category rather than chosen by the user, so it reads quieter
  // than a tag they set themselves and carries no remove control.
  autoBadge: {
    backgroundColor: colors.slate[100],
    borderColor: colors.slate[200],
  },
  autoBadgeText: {
    color: colors.slate[600],
  },
  disclosure: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    marginTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.slate[100],
  },
  disclosureText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    color: colors.slate[600],
  },
  disclosureAmount: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: colors.slate[500],
  },
  // States the span once for the whole list, so no row has to repeat it.
  periodNote: {
    fontSize: typography.fontSize.xs,
    color: colors.slate[400],
    marginBottom: spacing.sm,
  },
});

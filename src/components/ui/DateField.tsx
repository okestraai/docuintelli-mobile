import React, { useMemo, useState } from 'react';
import { Keyboard, Modal, Pressable, StyleSheet, Text, TouchableOpacity, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react-native';
import { fromIso, humaniseDate, monthGrid, toIso, yearPage, YEARS_PER_PAGE } from '../../lib/dateInput';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { borderRadius, spacing } from '../../theme/spacing';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

interface DateFieldProps {
  label?: string;
  value: string;
  onChange: (iso: string) => void;
  placeholder?: string;
  error?: string;
  clearable?: boolean;
  minDate?: string;
  maxDate?: string;
  /** The month shown when no date is set yet. */
  openOn?: Date;
  showIcon?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
  triggerStyle?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

export default function DateField({
  label,
  value,
  onChange,
  placeholder = 'Select a date',
  error,
  clearable,
  minDate,
  maxDate,
  openOn,
  showIcon = true,
  containerStyle,
  triggerStyle,
  textStyle,
}: DateFieldProps) {
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [choosingYear, setChoosingYear] = useState(false);
  const [month, setMonth] = useState(() => fromIso(value) ?? openOn ?? new Date());
  const [yearAnchor, setYearAnchor] = useState(month.getFullYear());
  const iso = value ? value.slice(0, 10) : '';
  const today = toIso(new Date());
  const cells = useMemo(() => monthGrid(month), [month]);
  const min = minDate?.slice(0, 7);
  const max = maxDate?.slice(0, 7);
  const monthKey = (d: Date) => toIso(d).slice(0, 7);
  const canGoBack = !min || monthKey(new Date(month.getFullYear(), month.getMonth() - 1, 1)) >= min;
  const canGoForward = !max || monthKey(new Date(month.getFullYear(), month.getMonth() + 1, 1)) <= max;

  const openSheet = () => {
    Keyboard.dismiss();
    const start = fromIso(value) ?? openOn ?? new Date();
    setMonth(start);
    setYearAnchor(start.getFullYear());
    setChoosingYear(false);
    setOpen(true);
  };

  const pick = (date: Date) => {
    onChange(toIso(date));
    setOpen(false);
  };

  return (
    <View style={containerStyle}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label ?? 'Date'}. ${iso ? humaniseDate(iso) : placeholder}`}
        onPress={openSheet}
        style={[styles.trigger, error ? styles.triggerError : undefined, triggerStyle]}
      >
        {showIcon ? <Calendar size={18} color={colors.slate[400]} strokeWidth={1.8} /> : null}
        <Text numberOfLines={1} style={[styles.triggerText, !iso && styles.placeholder, textStyle, !iso && styles.placeholder]}>
          {iso ? humaniseDate(iso) : placeholder}
        </Text>
        {clearable && iso ? (
          <Pressable accessibilityRole="button" accessibilityLabel={`Clear ${label ?? 'date'}`} hitSlop={10} onPress={() => onChange('')}>
            <X size={16} color={colors.slate[400]} />
          </Pressable>
        ) : null}
      </Pressable>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close date picker" style={styles.scrim} onPress={() => setOpen(false)}>
          <Pressable accessibilityViewIsModal onPress={() => {}} style={[styles.sheet, { paddingBottom: spacing.xl + insets.bottom }]}>
            <Text accessibilityRole="header" style={styles.sheetTitle}>{label?.replace(/\s*\*$/, '') ?? 'Select a date'}</Text>

            {choosingYear ? (
              <>
                <View style={styles.headerRow}>
                  <TouchableOpacity accessibilityRole="button" accessibilityLabel="Earlier years" style={styles.navButton} onPress={() => setYearAnchor(yearAnchor - YEARS_PER_PAGE)}>
                    <ChevronLeft size={20} color={colors.slate[700]} />
                  </TouchableOpacity>
                  <Text style={styles.headerText}>Choose a year</Text>
                  <TouchableOpacity accessibilityRole="button" accessibilityLabel="Later years" style={styles.navButton} onPress={() => setYearAnchor(yearAnchor + YEARS_PER_PAGE)}>
                    <ChevronRight size={20} color={colors.slate[700]} />
                  </TouchableOpacity>
                </View>
                <View style={styles.yearGrid}>
                  {yearPage(yearAnchor).map((year) => {
                    const blocked = (min && `${year}-12` < min) || (max && `${year}-01` > max);
                    const selected = year === month.getFullYear();
                    return (
                      <TouchableOpacity
                        key={year}
                        accessibilityRole="button"
                        accessibilityState={{ selected, disabled: !!blocked }}
                        disabled={!!blocked}
                        style={styles.yearCell}
                        onPress={() => { setMonth(new Date(year, month.getMonth(), 1)); setChoosingYear(false); }}
                      >
                        <Text style={[styles.yearText, selected && styles.selectedYearText, !!blocked && styles.blocked]}>{year}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            ) : (
              <>
                <View style={styles.headerRow}>
                  <TouchableOpacity accessibilityRole="button" accessibilityLabel="Previous month" disabled={!canGoBack} style={styles.navButton} onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>
                    <ChevronLeft size={20} color={canGoBack ? colors.slate[700] : colors.slate[300]} />
                  </TouchableOpacity>
                  <TouchableOpacity accessibilityRole="button" accessibilityLabel="Choose a year" style={styles.headerButton} onPress={() => { setYearAnchor(month.getFullYear()); setChoosingYear(true); }}>
                    <Text style={styles.headerLink}>{MONTHS[month.getMonth()]} {month.getFullYear()}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity accessibilityRole="button" accessibilityLabel="Next month" disabled={!canGoForward} style={styles.navButton} onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>
                    <ChevronRight size={20} color={canGoForward ? colors.slate[700] : colors.slate[300]} />
                  </TouchableOpacity>
                </View>
                <View style={styles.grid}>
                  {WEEKDAYS.map((day, index) => (
                    <View key={`${day}-${index}`} style={styles.cell}><Text style={styles.weekday}>{day}</Text></View>
                  ))}
                  {cells.map((date, index) => {
                    if (!date) return <View key={`blank-${index}`} style={styles.cell} />;
                    const dayIso = toIso(date);
                    const selected = dayIso === iso;
                    const blocked = (minDate && dayIso < minDate.slice(0, 10)) || (maxDate && dayIso > maxDate.slice(0, 10));
                    return (
                      <TouchableOpacity
                        key={dayIso}
                        accessibilityRole="button"
                        accessibilityLabel={humaniseDate(dayIso)}
                        accessibilityState={{ selected, disabled: !!blocked }}
                        disabled={!!blocked}
                        style={styles.cell}
                        onPress={() => pick(date)}
                      >
                        <View style={[styles.day, selected && styles.selectedDay, !selected && dayIso === today && styles.today]}>
                          <Text style={[styles.dayText, selected && styles.selectedDayText, !!blocked && styles.blocked]}>{date.getDate()}</Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.slate[700], marginBottom: 6 },
  trigger: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 48, paddingHorizontal: 14,
    borderWidth: 1.5, borderColor: colors.slate[200], borderRadius: borderRadius.xl, backgroundColor: colors.white,
  },
  triggerError: { borderColor: colors.error[500] },
  triggerText: { flex: 1, fontSize: typography.fontSize.base, color: colors.slate[900] },
  placeholder: { color: colors.slate[400] },
  errorText: { fontSize: typography.fontSize.xs, color: colors.error[600], marginTop: 4, marginLeft: 4 },
  scrim: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.white, borderTopLeftRadius: borderRadius.xl, borderTopRightRadius: borderRadius.xl, padding: spacing.xl, alignSelf: 'center', width: '100%', maxWidth: 520 },
  sheetTitle: { fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.bold, color: colors.slate[900], marginBottom: spacing.sm },
  headerRow: { flexDirection: 'row', alignItems: 'center', minHeight: 44 },
  navButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerButton: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  headerText: { flex: 1, textAlign: 'center', fontSize: typography.fontSize.base, fontWeight: typography.fontWeight.semibold, color: colors.slate[900] },
  headerLink: { fontSize: typography.fontSize.base, fontWeight: typography.fontWeight.semibold, color: colors.primary[600] },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: '14.28%', height: 44, alignItems: 'center', justifyContent: 'center' },
  weekday: { fontSize: typography.fontSize.xs, color: colors.slate[500] },
  day: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  today: { borderWidth: 1, borderColor: colors.primary[600] },
  selectedDay: { backgroundColor: colors.primary[600] },
  dayText: { fontSize: typography.fontSize.sm, color: colors.slate[800] },
  selectedDayText: { color: colors.white, fontWeight: typography.fontWeight.semibold },
  blocked: { color: colors.slate[300] },
  yearGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  yearCell: { width: '33.33%', minHeight: 52, alignItems: 'center', justifyContent: 'center' },
  yearText: { fontSize: typography.fontSize.base, color: colors.slate[800] },
  selectedYearText: { color: colors.primary[600], fontWeight: typography.fontWeight.bold },
});

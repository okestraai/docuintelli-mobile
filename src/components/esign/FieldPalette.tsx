import React from 'react';
import { Text, TouchableOpacity, View, StyleSheet, Platform } from 'react-native';
import {
  Pen,
  User,
  AtSign,
  Calendar,
  Type,
  CheckSquare,
  Briefcase,
  Building2,
  FileText,
} from 'lucide-react-native';
import { colors } from '../../theme/colors';
import type { FieldType } from '../../types/esignature';

interface FieldPaletteProps {
  selectedFieldType: FieldType | null;
  onSelectFieldType: (type: FieldType | null) => void;
}

const FIELD_TYPES: { type: FieldType; label: string; icon: typeof Pen }[] = [
  { type: 'signature', label: 'Sign', icon: Pen },
  { type: 'full_name', label: 'Name', icon: User },
  { type: 'initials', label: 'Init', icon: AtSign },
  { type: 'date_signed', label: 'Date', icon: Calendar },
  { type: 'text_field', label: 'Text', icon: Type },
  { type: 'checkbox', label: 'Check', icon: CheckSquare },
  { type: 'title_role', label: 'Title', icon: Briefcase },
  { type: 'company_name', label: 'Co.', icon: Building2 },
  { type: 'custom_text', label: 'Other', icon: FileText },
];

export default function FieldPalette({ selectedFieldType, onSelectFieldType }: FieldPaletteProps) {
  return (
    <View
      style={[
        styles.container,
        Platform.OS === 'web' && ({ overflowX: 'auto', WebkitOverflowScrolling: 'touch' } as any),
      ]}
    >
      {FIELD_TYPES.map(({ type, label, icon: Icon }) => {
        const isSelected = selectedFieldType === type;
        return (
          <TouchableOpacity
            key={type}
            style={[styles.chip, isSelected && styles.chipActive]}
            onPress={() => onSelectFieldType(isSelected ? null : type)}
            activeOpacity={0.7}
          >
            <Icon
              size={12}
              color={isSelected ? colors.primary[600] : colors.slate[400]}
            />
            <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>
              {label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 2,
    gap: 4,
    height: 32,
    flexShrink: 0,
    flexGrow: 0,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.slate[200],
    backgroundColor: colors.white,
    flexShrink: 0,
  },
  chipActive: {
    borderColor: colors.primary[400],
    backgroundColor: colors.primary[50],
  },
  chipText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.slate[500],
  },
  chipTextActive: {
    color: colors.primary[700],
  },
});

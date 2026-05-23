import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { AlertTriangle, X } from 'lucide-react-native';
import { useAppStore } from '../../store/appStore';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing } from '../../theme/spacing';

export default function CompromisedDeviceBanner() {
  const isCompromised = useAppStore((s) => s.isCompromised);
  const setCompromised = useAppStore((s) => s.setCompromised);

  if (!isCompromised) return null;

  return (
    <View
      style={styles.container}
      accessibilityRole="alert"
      accessibilityLabel="Security warning: this device may be compromised. Your data may be at risk."
    >
      <View style={styles.content}>
        <AlertTriangle size={16} color={colors.error[800]} strokeWidth={2} />
        <Text style={styles.text}>
          Security Warning: This device may be compromised. Your data may be at risk.
        </Text>
        <TouchableOpacity
          onPress={() => setCompromised(false)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Dismiss warning"
        >
          <X size={16} color={colors.error[600]} strokeWidth={2} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.error[50],
    borderBottomWidth: 1,
    borderBottomColor: colors.error[200],
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    zIndex: 100,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  text: {
    flex: 1,
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    color: colors.error[800],
    lineHeight: 16,
  },
});

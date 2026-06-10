import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { FileQuestion } from 'lucide-react-native';
import { router } from 'expo-router';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing, borderRadius } from '../../theme/spacing';

/**
 * Generic 404 view. Rendered for routes that should appear not to exist for the
 * current user (e.g. super-admin-only feature screens reached by deep link).
 */
export default function NotFoundView() {
  return (
    <View style={styles.container}>
      <View style={styles.iconWrap}>
        <FileQuestion size={40} color={colors.slate[400]} strokeWidth={2} />
      </View>
      <Text style={styles.title}>Page not found</Text>
      <Text style={styles.subtitle}>
        The page you're looking for doesn't exist or has moved.
      </Text>
      <TouchableOpacity
        style={styles.button}
        onPress={() => router.replace('/(tabs)/dashboard')}
        activeOpacity={0.8}
      >
        <Text style={styles.buttonText}>Back to Home</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.white,
    paddingHorizontal: spacing.xl,
  },
  iconWrap: {
    backgroundColor: colors.slate[100],
    padding: spacing.lg,
    borderRadius: borderRadius.xl,
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.slate[900],
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: typography.fontSize.base,
    color: colors.slate[500],
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  button: {
    backgroundColor: colors.primary[600],
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
  },
  buttonText: {
    color: colors.white,
    fontWeight: typography.fontWeight.semibold,
    fontSize: typography.fontSize.base,
  },
});

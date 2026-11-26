import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Building2 } from 'lucide-react-native';
import { useAuthStore } from '../src/store/authStore';
import { colors } from '../src/theme/colors';
import { typography } from '../src/theme/typography';
import { spacing, borderRadius } from '../src/theme/spacing';

/**
 * Shown when an account our admins converted to DocuIntelli for Business signs in to the phone app.
 * The personal app is locked for these accounts (the server answers 403 ACCOUNT_MIGRATED), so this
 * explains why rather than leaving every screen failing. The app is personal-only, so the only action
 * here is to sign out; the business app is used on the web.
 */
export default function AccountMoved() {
  const { firm } = useLocalSearchParams<{ firm?: string }>();
  const { signOut } = useAuthStore();
  return (
    <>
      <Stack.Screen options={{ headerShown: false, gestureEnabled: false }} />
      <SafeAreaView style={styles.safe}>
        <View style={styles.body}>
          <View style={styles.icon}>
            <Building2 size={28} color={colors.primary[700]} />
          </View>
          <Text style={styles.title}>Your account moved to DocuIntelli for Business</Text>
          <Text style={styles.text}>
            {firm ? `Your documents are now with ${firm}. ` : 'Your documents are now in your firm’s workspace. '}
            This app is for personal accounts, so there’s nothing to show here. Sign in to DocuIntelli for Business on
            the web to keep working.
          </Text>
          <TouchableOpacity
            style={styles.button}
            onPress={async () => {
              await signOut();
              router.replace('/(auth)/login');
            }}
          >
            <Text style={styles.buttonText}>Sign out</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  icon: { backgroundColor: colors.primary[50], borderRadius: borderRadius.full, padding: spacing.md, marginBottom: spacing.lg },
  title: { fontSize: typography.fontSize.xl, fontWeight: typography.fontWeight.bold, color: colors.slate[900], textAlign: 'center' },
  text: { fontSize: typography.fontSize.sm, color: colors.slate[600], textAlign: 'center', marginTop: spacing.sm, lineHeight: 20 },
  button: { marginTop: spacing.xl, backgroundColor: colors.primary[600], borderRadius: borderRadius.lg, paddingHorizontal: spacing.xl, paddingVertical: spacing.sm + 4 },
  buttonText: { color: '#fff', fontWeight: typography.fontWeight.semibold, fontSize: typography.fontSize.base },
});

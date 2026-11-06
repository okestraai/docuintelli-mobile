import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, AppState, Modal, View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, usePathname } from 'expo-router';
import { Smartphone } from 'lucide-react-native';
import Button from './ui/Button';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { spacing } from '../theme/spacing';
import { auth } from '../lib/auth';
import { API_BASE } from '../lib/config';
import { useAuthStore } from '../store/authStore';
import {
  canUseWhileBlocked,
  onDeviceLimit,
  type DeviceLimitDetail,
} from '../lib/deviceLimitInterceptor';

const CHECK_TIMEOUT_MS = 6000;

// Covers the whole app for a device over the plan's limit, from sign-in until the block is fixed.
export default function DeviceLimitModal() {
  const [detail, setDetail] = useState<DeviceLimitDetail | null>(null);
  const [checking, setChecking] = useState(false);
  const signedIn = useAuthStore((state) => !!state.session);
  const pathname = usePathname();

  useEffect(() => onDeviceLimit(setDetail), []);

  // A refused call raises the block through the interceptor; a good answer lifts it.
  const recheck = useCallback(async () => {
    const { data: { session } } = await auth.getSession();
    if (!session) return;
    const res = await fetch(`${API_BASE}/api/user/profile`, { headers: { Authorization: `Bearer ${session.access_token}` } });
    if (res.ok) setDetail(null);
  }, []);

  useEffect(() => {
    if (!signedIn) {
      setDetail(null);
      setChecking(false);
      return;
    }
    let active = true;
    setChecking(true);
    // Being offline or a slow server doesn't lock anyone out.
    const timeout = new Promise((resolve) => setTimeout(resolve, CHECK_TIMEOUT_MS));
    Promise.race([recheck().catch(() => {}), timeout]).finally(() => {
      if (active) setChecking(false);
    });
    return () => {
      active = false;
    };
  }, [signedIn, recheck]);

  const blocked = !!detail;

  // Coming back from the device list or billing is when the block may have been fixed.
  useEffect(() => {
    if (blocked && !canUseWhileBlocked(pathname)) recheck().catch(() => {});
  }, [blocked, pathname, recheck]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' && blocked) recheck().catch(() => {});
    });
    return () => subscription.remove();
  }, [blocked, recheck]);

  if (!signedIn || canUseWhileBlocked(pathname) || (!detail && !checking)) return null;

  const signOut = () => useAuthStore.getState().signOut();

  return (
    <Modal visible animationType="none" onRequestClose={() => {}} accessibilityViewIsModal>
      <SafeAreaView style={styles.screen}>
        {!detail ? (
          <ActivityIndicator size="large" color={colors.primary[600]} />
        ) : (
          <View style={styles.content}>
            <View style={styles.iconWrap}>
              <Smartphone size={24} color={colors.warning[600]} strokeWidth={2} />
            </View>
            <Text accessibilityRole="header" style={styles.title}>
              {detail.code === 'DEVICE_BLOCKED' ? 'This device is deactivated' : 'Device limit reached'}
            </Text>
            <Text style={styles.body}>
              {detail.message ||
                `Your plan allows ${detail.limit ?? 1} device${detail.limit === 1 ? '' : 's'} at a time.`}
            </Text>
            <Text style={styles.body}>To use DocuIntelli here, remove another device or upgrade for more devices.</Text>
            <View style={styles.actions}>
              <Button title="Manage devices" onPress={() => router.push('/settings/devices')} fullWidth />
              <Button title="Upgrade plan" variant="outline" onPress={() => router.push('/billing')} fullWidth />
              <Button title="Sign out" variant="ghost" onPress={signOut} fullWidth />
            </View>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    width: '100%',
    maxWidth: 440,
    padding: spacing['2xl'],
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.warning[100],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.slate[900],
    marginBottom: spacing.sm,
  },
  body: {
    fontSize: typography.fontSize.base,
    color: colors.slate[600],
    lineHeight: 22,
    marginBottom: spacing.md,
  },
  actions: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
});

import { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Smartphone } from 'lucide-react-native';
import Modal from './ui/Modal';
import Button from './ui/Button';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { spacing } from '../theme/spacing';
import {
  onDeviceLimit,
  type DeviceLimitDetail,
} from '../lib/deviceLimitInterceptor';

/**
 * Global listener for device-limit 403s (see deviceLimitInterceptor). Explains
 * why the current device was blocked and offers the two ways out: manage
 * devices or upgrade. Mounted once at the app root.
 */
export default function DeviceLimitModal() {
  const [detail, setDetail] = useState<DeviceLimitDetail | null>(null);

  useEffect(() => onDeviceLimit(setDetail), []);

  if (!detail) return null;

  const planName = detail.plan
    ? detail.plan.charAt(0).toUpperCase() + detail.plan.slice(1)
    : 'current';
  const limit = detail.limit ?? 1;
  const isDowngradeBlock = detail.code === 'DEVICE_BLOCKED';

  const close = () => setDetail(null);
  const go = (path: '/settings/devices' | '/billing') => {
    close();
    router.push(path);
  };

  return (
    <Modal visible onClose={close}>
      <View style={styles.iconWrap}>
        <Smartphone size={24} color={colors.warning[600]} strokeWidth={2} />
      </View>

      <Text style={styles.title}>
        {isDowngradeBlock ? 'This device is deactivated' : 'Device limit reached'}
      </Text>

      <Text style={styles.body}>
        {detail.message ||
          `Your ${planName} plan allows ${limit} device${limit !== 1 ? 's' : ''} at a time.`}
      </Text>
      <Text style={styles.body}>
        To keep using DocuIntelli here, remove another device from Settings → Devices, or upgrade
        for more devices.
      </Text>

      <View style={styles.actions}>
        <Button title="Manage devices" onPress={() => go('/settings/devices')} fullWidth />
        <Button
          title="Upgrade plan"
          variant="outline"
          onPress={() => go('/billing')}
          fullWidth
        />
        <Button title="Dismiss" variant="ghost" onPress={close} fullWidth />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
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

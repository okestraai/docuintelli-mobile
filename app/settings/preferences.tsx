import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Switch, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Bell,
  Shield,
  CreditCard,
  FileText,
  BarChart3,
  Compass,
  Activity,
} from 'lucide-react-native';
import { getUserProfile, updateUserProfile, type UserProfile } from '../../src/lib/auth';
import { useSubscription } from '../../src/hooks/useSubscription';
import Card from '../../src/components/ui/Card';
import Button from '../../src/components/ui/Button';
import GradientIcon from '../../src/components/ui/GradientIcon';
import LoadingSpinner from '../../src/components/ui/LoadingSpinner';
import Toast from '../../src/components/ui/Toast';
import { colors } from '../../src/theme/colors';
import { typography } from '../../src/theme/typography';
import { spacing, borderRadius } from '../../src/theme/spacing';

interface PreferenceItem {
  key: keyof Pick<
    UserProfile,
    'security_alerts' | 'billing_alerts' | 'document_alerts' | 'engagement_digests' | 'life_event_alerts' | 'activity_alerts'
  >;
  title: string;
  description: string;
  icon: React.ReactNode;
  iconBg: string;
  // Security & billing emails always send; the rest are suppressed for Free
  // (email_notifications flag off) — the backend ignores these toggles there.
  alwaysOn?: boolean;
}

const preferenceItems: PreferenceItem[] = [
  {
    key: 'security_alerts',
    title: 'Security & Account',
    description: 'Password changes, login alerts, and account activity',
    icon: <Shield size={18} color={colors.error[600]} strokeWidth={1.8} />,
    iconBg: colors.error[50],
    alwaysOn: true,
  },
  {
    key: 'billing_alerts',
    title: 'Billing & Subscription',
    description: 'Payment confirmations, plan changes, and renewal reminders',
    icon: <CreditCard size={18} color={colors.info[600]} strokeWidth={1.8} />,
    iconBg: colors.info[50],
    alwaysOn: true,
  },
  {
    key: 'document_alerts',
    title: 'Document Alerts',
    description: 'Expiration reminders, processing updates, and review nudges',
    icon: <FileText size={18} color={colors.primary[600]} strokeWidth={1.8} />,
    iconBg: colors.primary[50],
  },
  {
    key: 'engagement_digests',
    title: 'Engagement Digests',
    description: 'Weekly summaries, readiness scores, and activity insights',
    icon: <BarChart3 size={18} color="#6b21a8" strokeWidth={1.8} />,
    iconBg: '#f3e8ff',
  },
  {
    key: 'life_event_alerts',
    title: 'Life Events',
    description: 'Preparedness updates and document recommendations',
    icon: <Compass size={18} color={colors.warning[600]} strokeWidth={1.8} />,
    iconBg: colors.warning[50],
  },
  {
    key: 'activity_alerts',
    title: 'Activity Alerts',
    description: 'Usage milestones, tips, and product updates',
    icon: <Activity size={18} color={colors.slate[600]} strokeWidth={1.8} />,
    iconBg: colors.slate[100],
  },
];

export default function PreferencesScreen() {
  const { featureFlags } = useSubscription();
  // Free plan = in-app notifications only. Notification-category emails are
  // suppressed server-side, so these toggles have no effect — disable them.
  const emailNotificationsEnabled = featureFlags.email_notifications;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preferences, setPreferences] = useState<Record<string, boolean>>({
    security_alerts: true,
    billing_alerts: true,
    document_alerts: true,
    engagement_digests: true,
    life_event_alerts: true,
    activity_alerts: true,
  });
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error'; visible: boolean }>({
    message: '',
    type: 'success',
    visible: false,
  });

  const loadPreferences = useCallback(async () => {
    try {
      setLoading(true);
      const profile = await getUserProfile();
      if (profile) {
        setPreferences({
          security_alerts: profile.security_alerts ?? true,
          billing_alerts: profile.billing_alerts ?? true,
          document_alerts: profile.document_alerts ?? true,
          engagement_digests: profile.engagement_digests ?? true,
          life_event_alerts: profile.life_event_alerts ?? true,
          activity_alerts: profile.activity_alerts ?? true,
        });
      }
    } catch {
      setToast({ message: 'Failed to load preferences', type: 'error', visible: true });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPreferences();
  }, [loadPreferences]);

  const togglePreference = (key: string) => {
    setPreferences((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await updateUserProfile(preferences as Partial<UserProfile>);
      setToast({ message: 'Preferences saved successfully', type: 'success', visible: true });
    } catch {
      setToast({ message: 'Failed to save preferences', type: 'error', visible: true });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingSpinner fullScreen />;
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <GradientIcon size={44}>
            <Bell size={22} color={colors.white} strokeWidth={1.8} />
          </GradientIcon>
          <View>
            <Text style={styles.pageTitle}>Notifications</Text>
            <Text style={styles.pageSubtitle}>Choose what emails you receive</Text>
          </View>
        </View>

        {/* Free-plan notice — notification emails only send on paid plans */}
        {!emailNotificationsEnabled && (
          <Card style={styles.freeNotice}>
            <Text style={styles.freeNoticeText}>
              Your plan uses in-app notifications only. Upgrade to a paid plan to
              receive document, engagement, life-event, and activity emails.
              Security and billing emails are always sent.
            </Text>
          </Card>
        )}

        {/* Preference cards */}
        {preferenceItems.map((item) => {
          // Notification-category toggles are inert for Free — disable them.
          const disabled = !item.alwaysOn && !emailNotificationsEnabled;
          return (
            <Card key={item.key} style={disabled ? styles.disabledCard : undefined}>
              <View style={styles.prefRow}>
                <View style={[styles.prefIconWrap, { backgroundColor: item.iconBg }]}>
                  {item.icon}
                </View>
                <View style={styles.prefContent}>
                  <Text style={styles.prefTitle}>{item.title}</Text>
                  <Text style={styles.prefDescription}>{item.description}</Text>
                </View>
                <Switch
                  value={disabled ? false : preferences[item.key]}
                  onValueChange={() => togglePreference(item.key)}
                  disabled={disabled}
                  trackColor={{ true: colors.primary[500], false: colors.slate[200] }}
                  thumbColor={colors.white}
                />
              </View>
            </Card>
          );
        })}

        {/* Note */}
        <Text style={styles.noteText}>
          Critical emails (welcome, password reset, account deletion) are always sent and cannot
          be disabled.
        </Text>

        {/* Save button */}
        <Button
          title="Save Preferences"
          onPress={handleSave}
          loading={saving}
          disabled={saving}
          fullWidth
        />
      </ScrollView>

      <Toast
        message={toast.message}
        type={toast.type}
        visible={toast.visible}
        onDismiss={() => setToast((prev) => ({ ...prev, visible: false }))}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.slate[50] },
  scroll: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xl },

  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  pageTitle: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.slate[900],
  },
  pageSubtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[500],
    marginTop: 2,
  },

  // Preference items
  prefRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  prefIconWrap: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledCard: { opacity: 0.55 },
  freeNotice: {
    backgroundColor: colors.primary[50],
    borderWidth: 1,
    borderColor: colors.primary[200],
  },
  freeNoticeText: {
    fontSize: typography.fontSize.sm,
    color: colors.primary[800],
    lineHeight: typography.fontSize.sm * typography.lineHeight.normal,
  },
  prefContent: { flex: 1 },
  prefTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.slate[900],
    marginBottom: 2,
  },
  prefDescription: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[500],
    lineHeight: typography.fontSize.sm * typography.lineHeight.normal,
  },

  // Note
  noteText: {
    fontSize: typography.fontSize.xs,
    color: colors.slate[400],
    textAlign: 'center',
    lineHeight: typography.fontSize.xs * typography.lineHeight.normal,
    paddingHorizontal: spacing.lg,
  },
});

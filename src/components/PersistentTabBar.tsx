import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { usePathname, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LayoutDashboard, FileText, Landmark, Compass, Settings, Crown } from 'lucide-react-native';
import { useSubscription } from '../hooks/useSubscription';
import type { FeatureFlags } from '../types/subscription';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { spacing } from '../theme/spacing';

// `flag` — when set, the tab is only visible when that feature flag is present.
// `lockFlag` — when set, the tab shows a lock badge (upsell) while the flag is absent.
// `lockTier` — visual tint of the lock badge ('pro' = amber, 'starter' = primary).
type TabDef = {
  label: string;
  route: string;
  icon: typeof LayoutDashboard;
  match: string[];
  visibleFlag?: keyof FeatureFlags;
  lockFlag?: keyof FeatureFlags;
  lockTier?: 'starter' | 'pro';
};

const TABS: TabDef[] = [
  {
    label: 'Home',
    route: '/(tabs)/dashboard',
    icon: LayoutDashboard,
    match: ['/dashboard'],
  },
  {
    label: 'Vault',
    route: '/(tabs)/vault',
    icon: FileText,
    match: ['/vault'],
  },
  {
    label: 'Financial',
    route: '/financial-insights',
    icon: Landmark,
    match: ['/financial-insights', '/stockpulse'],
    // Financial (insights + StockPulse) is Pro/Family — gate on the flag so
    // the Family tier is included (never `plan === 'pro'`).
    visibleFlag: 'financial_insights',
  },
  {
    label: 'Life Events',
    route: '/life-events',
    icon: Compass,
    match: ['/life-events'],
    lockFlag: 'life_events',
    lockTier: 'starter',
  },
  {
    label: 'Settings',
    route: '/(tabs)/settings',
    icon: Settings,
    match: ['/settings', '/billing', '/help', '/status'],
  },
];

// Screens where the tab bar should be hidden (auth, splash, full-screen flows)
const HIDDEN_ON = ['/', '/index', '/login', '/signup', '/forgot-password', '/legal'];
const HIDDEN_PREFIXES = ['/(auth)', '/esign'];

export default function PersistentTabBar() {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { featureFlags, loading: subLoading } = useSubscription();

  // Hide on auth / splash / full-screen signing screens
  const shouldHide = HIDDEN_ON.some((p) => pathname === p) ||
    HIDDEN_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  if (shouldHide) return null;

  // Hide tabs whose feature flag is absent (e.g. Financial for non-Pro/Family).
  const visibleTabs = TABS.filter(
    (tab) => !tab.visibleFlag || featureFlags[tab.visibleFlag]
  );

  const bottomPadding = Math.max(insets.bottom, 8);

  const isLocked = (tab: TabDef) => {
    if (!tab.lockFlag) return false;
    if (subLoading) return false; // Don't show lock badges while subscription is loading
    return !featureFlags[tab.lockFlag];
  };

  return (
    <View
      style={[
        styles.container,
        { paddingBottom: bottomPadding },
      ]}
    >
      {visibleTabs.map((tab) => {
        const active = tab.match.some((m) => pathname.includes(m));
        const locked = isLocked(tab);
        const Icon = tab.icon;
        return (
          <TouchableOpacity
            key={tab.label}
            style={styles.tab}
            onPress={() => router.navigate(tab.route as any)}
            activeOpacity={0.7}
            accessibilityRole="tab"
            accessibilityLabel={locked ? `${tab.label}, requires upgrade` : tab.label}
            accessibilityState={{ selected: active }}
          >
            <View style={{ position: 'relative' }}>
              <Icon
                size={22}
                color={active ? colors.primary[600] : colors.slate[400]}
                strokeWidth={1.8}
              />
              {locked && (
                <View style={[
                  styles.crownBadge,
                  { backgroundColor: tab.lockTier === 'pro' ? '#d97706' : colors.primary[600] },
                ]}>
                  <Crown size={8} color={colors.white} strokeWidth={2.5} />
                </View>
              )}
            </View>
            <Text style={[styles.label, active && styles.labelActive]}>
              {tab.label}
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
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.slate[200],
    paddingTop: 10,
    elevation: 2,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: -1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 4,
  },
  label: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: colors.slate[400],
  },
  labelActive: {
    color: colors.primary[600],
  },
  crownBadge: {
    position: 'absolute',
    top: -4,
    right: -6,
    width: 14,
    height: 14,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.white,
  },
});

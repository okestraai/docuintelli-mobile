import { useEffect, useRef, useState, useCallback } from 'react';
import { AppState, View, Text, StyleSheet, Platform, TouchableOpacity } from 'react-native';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import NetInfo from '@react-native-community/netinfo';
import * as WebBrowser from 'expo-web-browser';
import * as SplashScreen from 'expo-splash-screen';
import { ArrowLeft, Shield, Monitor } from 'lucide-react-native';
import { goBack } from '../src/utils/navigation';
import { auth } from '../src/lib/auth';
import { API_BASE } from '../src/lib/config';
import { useAuthStore } from '../src/store/authStore';
import { useAppStore } from '../src/store/appStore';
import { useBiometrics } from '../src/hooks/useBiometrics';
import { usePushNotifications } from '../src/hooks/usePushNotifications';
import { useNotifications } from '../src/hooks/useNotifications';
import { setupDeepLinkListener } from '../src/services/deepLinking';
import { configureRevenueCat, loginUser, logoutUser } from '../src/lib/iapService';
import { ToastProvider, ToastRenderer } from '../src/contexts/ToastContext';
import { SubscriptionProvider } from '../src/contexts/SubscriptionContext';
import ErrorBoundary from '../src/components/ErrorBoundary';
import AnimatedSplash from '../src/components/ui/AnimatedSplash';
import OfflineBanner from '../src/components/ui/OfflineBanner';
import CompromisedDeviceBanner from '../src/components/ui/CompromisedDeviceBanner';
import DunningBanner from '../src/components/ui/DunningBanner';
import PersistentTabBar from '../src/components/PersistentTabBar';
import DeviceLimitModal from '../src/components/DeviceLimitModal';
import { installDeviceLimitInterceptor } from '../src/lib/deviceLimitInterceptor';
import { GoalBubbleProvider } from '../src/contexts/GoalBubbleContext';
import { colors } from '../src/theme/colors';
import { typography } from '../src/theme/typography';
import { spacing, MAX_APP_WIDTH } from '../src/theme/spacing';

// Keep the native splash screen visible until we're ready to show our custom AnimatedSplash.
// This prevents a white flash between the OS splash and the JS-side splash.
SplashScreen.preventAutoHideAsync().catch(() => {});

// Complete any pending auth sessions (OAuth redirects back to the app).
// Must run at the module top level before any component renders.
WebBrowser.maybeCompleteAuthSession();

// Broadcast device-limit 403s to the global <DeviceLimitModal> before any fetch runs.
installDeviceLimitInterceptor();

export default function RootLayout() {
  const { initialized, loading, initialize, setSession, session } = useAuthStore();
  const setOnline = useAppStore((s) => s.setOnline);
  const isLocked = useAppStore((s) => s.isLocked);
  const setLocked = useAppStore((s) => s.setLocked);
  const { enabled: biometricEnabled, promptBiometric } = useBiometrics();
  const appState = useRef(AppState.currentState);
  const [unlocking, setUnlocking] = useState(false);
  const [splashDone, setSplashDone] = useState(false);

  // Initialize push notifications when authenticated
  usePushNotifications();

  // Poll for notification unread count (60s interval, pauses when backgrounded)
  useNotifications();

  useEffect(() => {
    const boot = async () => {
      // On web, check for OAuth callback in the URL query params.
      // Backend redirects back with ?auth_code=... (secure exchange flow)
      if (Platform.OS === 'web') {
        const params = new URLSearchParams(window.location.search);
        const authCode = params.get('auth_code');

        if (authCode) {
          // Exchange the short-lived auth code for real tokens
          try {
            const res = await fetch(`${API_BASE}/api/auth/exchange-code`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ code: authCode }),
            });
            if (res.ok) {
              const { access_token, refresh_token } = await res.json();
              if (access_token && refresh_token) {
                await auth.setSession({ access_token, refresh_token });
              }
            }
          } catch (e) {
            console.error('[OAuth] Failed to exchange auth code:', e);
          }

          // Clean code from URL so it isn't bookmarked or leaked via Referer
          const cleanUrl = window.location.origin + window.location.pathname;
          window.history.replaceState({}, '', cleanUrl);
        }

        // Legacy fallback: direct tokens in URL (for backwards compatibility)
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');
        if (accessToken && refreshToken) {
          await auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
          const cleanUrl = window.location.origin + window.location.pathname;
          window.history.replaceState({}, '', cleanUrl);
        }
      }

      // Now initialize (reads tokens from storage)
      await initialize();

      // Configure RevenueCat for native IAP
      if (Platform.OS !== 'web') {
        const currentSession = useAuthStore.getState().session;
        await configureRevenueCat(currentSession?.user?.id);
        if (currentSession?.user?.id) {
          loginUser(currentSession.user.id).catch(() => {});
        }
      }

      // On web, check for e-signature hash route from email links (/#/sign/{token})
      if (Platform.OS === 'web') {
        const hash = window.location.hash;
        const signMatch = hash.match(/^#\/sign\/(.+)$/);
        if (signMatch) {
          const signingToken = signMatch[1];
          // Clean the hash from the URL
          window.history.replaceState({}, '', window.location.pathname);

          // Check if user is authenticated
          const currentSession = useAuthStore.getState().session;
          if (currentSession) {
            // Logged in — go directly to signing
            setTimeout(() => {
              router.push({ pathname: '/esign/sign/[token]', params: { token: signingToken } });
            }, 100);
          } else {
            // Not logged in — save redirect for after login
            useAppStore.getState().setPendingRedirect('/esign/sign/[token]', { token: signingToken });
          }
        }
      }
    };

    boot();

    const {
      data: { subscription },
    } = auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
      // Sync RevenueCat user with auth state
      if (Platform.OS !== 'web') {
        if (sess?.user?.id) {
          loginUser(sess.user.id).catch(() => {});
        } else {
          logoutUser().catch(() => {});
        }
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Network monitoring
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setOnline(state.isConnected ?? true);
    });
    return () => unsubscribe();
  }, []);

  // Deep link listener
  useEffect(() => {
    const cleanup = setupDeepLinkListener();
    return cleanup;
  }, []);

  // Jailbreak / Root detection — warn but never block
  useEffect(() => {
    if (Platform.OS === 'web') return;
    (async () => {
      try {
        const { checkDeviceCompromised } = await import('../src/services/deviceSecurity');
        const compromised = await checkDeviceCompromised();
        if (compromised) {
          useAppStore.getState().setCompromised(true);
        }
      } catch {}
    })();
  }, []);

  // Biometric lock on app resume — only lock after being in background for >3 seconds
  // Skips re-locking when biometric prompt, modals, or OAuth sheets cause brief transitions
  const lastUnlockTime = useRef<number>(0);
  const backgroundTimestamp = useRef<number>(0);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (appState.current === 'active' && nextState.match(/inactive|background/)) {
        backgroundTimestamp.current = Date.now();
      }

      if (
        appState.current.match(/inactive|background/) &&
        nextState === 'active' &&
        biometricEnabled &&
        session
      ) {
        const bgElapsed = Date.now() - backgroundTimestamp.current;
        const unlockElapsed = Date.now() - lastUnlockTime.current;
        // Only lock if backgrounded for >3s AND not just unlocked in the last 5s
        if (bgElapsed > 3000 && unlockElapsed > 5000) {
          setLocked(true);
        }
      }
      appState.current = nextState;
    });

    return () => subscription.remove();
  }, [biometricEnabled, session]);

  const handleUnlock = async () => {
    setUnlocking(true);
    const success = await promptBiometric();
    if (success) {
      lastUnlockTime.current = Date.now();
      setLocked(false);
    }
    setUnlocking(false);
  };

  const handleSwitchToDesktop = useCallback(() => {
    if (Platform.OS === 'web') {
      document.cookie = 'prefer_desktop=1; path=/; max-age=86400; SameSite=Lax';
      window.location.reload();
    }
  }, []);

  if (!initialized || loading || !splashDone) {
    return <AnimatedSplash onFinish={() => setSplashDone(true)} />;
  }

  return (
    <ErrorBoundary>
    <SafeAreaProvider>
    <ToastProvider>
    <SubscriptionProvider>
    <View style={[{ flex: 1 }, Platform.OS === 'web' && webShell.outer]}>
      <View style={[{ flex: 1 }, Platform.OS === 'web' && webShell.inner]}>
      <StatusBar style="dark" translucent={false} />
      <OfflineBanner />
      <CompromisedDeviceBanner />
      {session && <DunningBanner />}
      <GoalBubbleProvider>
      <Stack
        screenOptions={{
          headerShown: false,
          headerStyle: { backgroundColor: colors.white },
          headerTintColor: colors.slate[900],
          headerTitleStyle: { fontWeight: '600', fontSize: 17 },
          headerShadowVisible: false,
          headerBackButtonDisplayMode: 'minimal',
          contentStyle: { backgroundColor: colors.slate[50] },
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => goBack()}
              style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.slate[100], alignItems: 'center', justifyContent: 'center', marginRight: 8 }}
              activeOpacity={0.7}
            >
              <ArrowLeft size={20} color={colors.slate[700]} strokeWidth={2} />
            </TouchableOpacity>
          ),
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="document/[id]"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="upload"
          options={{
            presentation: 'modal',
            headerShown: true,
            title: 'Upload Document',
          }}
        />
        <Stack.Screen
          name="search"
          options={{ headerShown: true, title: 'Search' }}
        />
        <Stack.Screen
          name="financial-insights"
          options={{ headerShown: true, title: 'Financial Insights' }}
        />
        <Stack.Screen
          name="life-events"
          options={{ headerShown: true, title: 'Life Events' }}
        />
        <Stack.Screen
          name="audit"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="stockpulse"
          options={{ headerShown: true, title: 'StockPulse AI' }}
        />
        <Stack.Screen
          name="billing"
          options={{ headerShown: true, title: 'Billing' }}
        />
        <Stack.Screen name="settings" />
        <Stack.Screen
          name="legal"
          options={{ headerShown: true, title: 'Legal' }}
        />
        <Stack.Screen
          name="help"
          options={{ headerShown: true, title: 'Help Center' }}
        />
        <Stack.Screen
          name="status"
          options={{ headerShown: true, title: 'System Status' }}
        />
        <Stack.Screen
          name="esign/sign/[token]"
          options={{ headerShown: false, presentation: 'fullScreenModal' }}
        />
        <Stack.Screen
          name="esign/sign-auth"
          options={{ headerShown: false, presentation: 'fullScreenModal' }}
        />
        <Stack.Screen
          name="esign/create"
          options={{ headerShown: false, presentation: 'fullScreenModal' }}
        />
      </Stack>

      {/* Persistent bottom navigation — visible on all pages */}
      <PersistentTabBar />
      </GoalBubbleProvider>

      {/* Toast rendered inside the app shell so it centers within 480px on web */}
      <ToastRenderer />

      {/* Global device-limit blocker — listens for 403 DEVICE_LIMIT_EXCEEDED/BLOCKED */}
      <DeviceLimitModal />

      {/* "View Desktop Site" link — web only */}
      {Platform.OS === 'web' && (
        <TouchableOpacity
          style={desktopSwitchStyles.container}
          onPress={handleSwitchToDesktop}
          activeOpacity={0.7}
        >
          <Monitor size={14} color={colors.slate[500]} />
          <Text style={desktopSwitchStyles.text}>View Desktop Site</Text>
        </TouchableOpacity>
      )}

      {/* Biometric lock overlay */}
      {isLocked && (
        <View style={lockStyles.overlay}>
          <View style={lockStyles.content}>
            <Shield size={48} color={colors.primary[600]} strokeWidth={1.5} />
            <Text style={lockStyles.title}>DocuIntelli Locked</Text>
            <Text style={lockStyles.subtitle}>Authenticate to continue</Text>
            <TouchableOpacity
              style={lockStyles.button}
              onPress={handleUnlock}
              disabled={unlocking}
              activeOpacity={0.7}
            >
              <Text style={lockStyles.buttonText}>
                {unlocking ? 'Authenticating...' : 'Unlock'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={lockStyles.fallbackButton}
              onPress={async () => {
                const { signOut } = useAuthStore.getState();
                await signOut();
                setLocked(false);
              }}
              activeOpacity={0.7}
            >
              <Text style={lockStyles.fallbackText}>Sign out instead</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
      </View>
    </View>
    </SubscriptionProvider>
    </ToastProvider>
    </SafeAreaProvider>
    </ErrorBoundary>
  );
}

const webShell = StyleSheet.create({
  outer: {
    alignItems: 'center',
    backgroundColor: colors.slate[100],
  },
  inner: {
    width: '100%',
    maxWidth: MAX_APP_WIDTH,
    backgroundColor: colors.slate[50],
    // Subtle shadow to frame the app on wide screens
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 8,
  },
});

const desktopSwitchStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.slate[200],
    backgroundColor: colors.white,
  },
  text: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[500],
  },
});

const lockStyles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.slate[50],
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 99999,
  },
  content: {
    alignItems: 'center',
    gap: spacing.lg,
  },
  title: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.slate[900],
  },
  subtitle: {
    fontSize: typography.fontSize.base,
    color: colors.slate[500],
  },
  button: {
    backgroundColor: colors.primary[600],
    paddingHorizontal: spacing['3xl'],
    paddingVertical: spacing.md,
    borderRadius: 12,
    marginTop: spacing.lg,
  },
  buttonText: {
    color: colors.white,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
  fallbackButton: {
    marginTop: spacing.sm,
    paddingVertical: spacing.sm,
  },
  fallbackText: {
    color: colors.slate[400],
    fontSize: typography.fontSize.sm,
    textDecorationLine: 'underline',
  },
});

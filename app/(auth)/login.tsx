import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import {
  ShieldCheck,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
} from 'lucide-react-native';
import Svg, { Path } from 'react-native-svg';
import * as AppleAuthentication from 'expo-apple-authentication';
import { signIn, signInWithGoogle, signInWithApple } from '../../src/lib/auth';
import { useAuthStore } from '../../src/store/authStore';
import { useAppStore } from '../../src/store/appStore';
import Button from '../../src/components/ui/Button';
import Input from '../../src/components/ui/Input';
import { colors } from '../../src/theme/colors';
import { typography } from '../../src/theme/typography';
import { spacing, borderRadius } from '../../src/theme/spacing';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Please enter both email and password');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await signIn(email, password);
      // Update auth store synchronously before navigating so the tabs
      // layout sees the user and doesn't redirect back to login.
      // fireEvent('SIGNED_IN') uses setTimeout(0), so the store
      // wouldn't be updated yet if we relied solely on the event.
      useAuthStore.getState().setSession(data.session);
      // Check for pending redirect (e.g. signing link from email)
      const pending = useAppStore.getState().consumePendingRedirect();
      if (pending) {
        router.replace({ pathname: pending.route as any, params: pending.params });
      } else {
        router.replace('/(tabs)/dashboard');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Sign in failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    setError(null);

    try {
      const data = await signInWithGoogle();
      // On web, the page redirects so this line won't execute.
      // On native, update the auth store before navigating (same race-condition fix).
      if (data?.session) {
        useAuthStore.getState().setSession(data.session);
      }
      const pending = useAppStore.getState().consumePendingRedirect();
      if (pending) {
        router.replace({ pathname: pending.route as any, params: pending.params });
      } else {
        router.replace('/(tabs)/dashboard');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Google sign-in failed');
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    setAppleLoading(true);
    setError(null);

    try {
      const result = await signInWithApple();
      if (result?.session) {
        useAuthStore.getState().setSession(result.session);
      }
      const pending = useAppStore.getState().consumePendingRedirect();
      if (pending) {
        router.replace({ pathname: pending.route as any, params: pending.params });
      } else {
        router.replace('/(tabs)/dashboard');
      }
    } catch (err: unknown) {
      // User cancelled — don't show error
      if ((err as any)?.code === 'ERR_REQUEST_CANCELED') return;
      setError(err instanceof Error ? err.message : 'Apple sign-in failed');
    } finally {
      setAppleLoading(false);
    }
  };

  return (
    <View style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* Gradient Header */}
          <LinearGradient
            colors={[...colors.gradient.primary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.gradientHeader}
          >
            <View style={styles.headerContent}>
              <View style={styles.logoContainer}>
                <ShieldCheck size={36} color={colors.white} strokeWidth={2} />
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <Text style={styles.brandName}>DocuIntelli AI</Text>
                <View style={{ backgroundColor: 'rgba(255,255,255,0.25)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                  <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700', letterSpacing: 1 }}>BETA</Text>
                </View>
              </View>
              <Text style={styles.welcomeTitle}>Welcome Back</Text>
              <Text style={styles.welcomeSubtitle}>
                Sign in to access your secure document vault
              </Text>
            </View>
            {/* Curved bottom edge */}
            <View style={styles.curveOverlay} />
          </LinearGradient>

          {/* Form Card */}
          <View style={styles.formCard}>
            {/* Error Message */}
            {error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {/* Email Input */}
            <Input
              label="Email Address"
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                if (error) setError(null);
              }}
              placeholder="you@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              editable={!loading}
              returnKeyType="next"
              blurOnSubmit={false}
              icon={<Mail size={18} color={colors.slate[400]} strokeWidth={1.8} />}
            />

            {/* Password Input */}
            <Input
              label="Password"
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                if (error) setError(null);
              }}
              placeholder="Enter your password"
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoComplete="password"
              editable={!loading}
              returnKeyType="done"
              onSubmitEditing={handleLogin}
              icon={<Lock size={18} color={colors.slate[400]} strokeWidth={1.8} />}
              rightIcon={
                showPassword ? (
                  <EyeOff size={18} color={colors.slate[500]} strokeWidth={1.8} />
                ) : (
                  <Eye size={18} color={colors.slate[500]} strokeWidth={1.8} />
                )
              }
              onRightIconPress={() => setShowPassword(!showPassword)}
            />

            {/* Forgot Password */}
            <TouchableOpacity
              onPress={() => router.push('/(auth)/forgot-password')}
              style={styles.forgotRow}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.forgotText}>Forgot your password?</Text>
            </TouchableOpacity>

            {/* Sign In Button */}
            <Button
              title="Sign In"
              onPress={handleLogin}
              loading={loading}
              disabled={loading}
              size="lg"
              iconRight={
                !loading ? (
                  <ArrowRight size={18} color={colors.white} strokeWidth={2} />
                ) : undefined
              }
            />

            {/* Divider */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or continue with</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Google Sign In */}
            <TouchableOpacity
              onPress={handleGoogleSignIn}
              style={[styles.googleButton, (loading || googleLoading) && { opacity: 0.6 }]}
              activeOpacity={0.7}
              disabled={loading || googleLoading}
            >
              {googleLoading ? (
                <ActivityIndicator size="small" color={colors.slate[600]} />
              ) : (
                <Svg width={20} height={20} viewBox="0 0 48 48">
                  <Path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                  <Path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                  <Path fill="#FBBC05" d="M10.53 28.59a14.5 14.5 0 0 1 0-9.18l-7.98-6.19a24.1 24.1 0 0 0 0 21.56l7.98-6.19z" />
                  <Path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                </Svg>
              )}
              <Text style={styles.googleText}>Continue with Google</Text>
            </TouchableOpacity>

            {/* Apple Sign In — iOS only */}
            {Platform.OS === 'ios' && (
              <AppleAuthentication.AppleAuthenticationButton
                buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
                buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                cornerRadius={borderRadius.lg}
                style={styles.appleButton}
                onPress={handleAppleSignIn}
              />
            )}
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <View style={styles.footerRow}>
              <Text style={styles.footerText}>Don't have an account? </Text>
              <TouchableOpacity
                onPress={() => router.push('/(auth)/signup')}
                hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
              >
                <Text style={styles.linkText}>Sign up</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.poweredBy}>Powered by Okestra AI Labs</Text>
            <View style={styles.legalRow}>
              <TouchableOpacity onPress={() => router.push({ pathname: '/legal', params: { page: 'terms' } })} hitSlop={8}>
                <Text style={styles.legalLink}>Terms</Text>
              </TouchableOpacity>
              <Text style={styles.legalDot}> · </Text>
              <TouchableOpacity onPress={() => router.push({ pathname: '/legal', params: { page: 'privacy' } })} hitSlop={8}>
                <Text style={styles.legalLink}>Privacy</Text>
              </TouchableOpacity>
              <Text style={styles.legalDot}> · </Text>
              <TouchableOpacity onPress={() => router.push({ pathname: '/legal', params: { page: 'cookies' } })} hitSlop={8}>
                <Text style={styles.legalLink}>Cookies</Text>
              </TouchableOpacity>
              <Text style={styles.legalDot}> · </Text>
              <TouchableOpacity onPress={() => router.push({ pathname: '/legal', params: { page: 'faq' } })} hitSlop={8}>
                <Text style={styles.legalLink}>Help</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.slate[50],
  },
  flex: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
  },

  /* ---- Gradient Header ---- */
  gradientHeader: {
    paddingTop: Platform.OS === 'ios' ? 60 : 48,
    paddingBottom: 48,
    paddingHorizontal: spacing['2xl'],
    position: 'relative',
    overflow: 'hidden',
  },
  headerContent: {
    alignItems: 'center',
    zIndex: 1,
  },
  logoContainer: {
    width: 68,
    height: 68,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  brandName: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: 'rgba(255,255,255,0.85)',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  welcomeTitle: {
    fontSize: typography.fontSize['3xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.white,
    marginBottom: spacing.xs,
  },
  welcomeSubtitle: {
    fontSize: typography.fontSize.base,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    lineHeight: typography.fontSize.base * typography.lineHeight.normal,
  },
  curveOverlay: {
    position: 'absolute',
    bottom: -1,
    left: 0,
    right: 0,
    height: 24,
    backgroundColor: colors.slate[50],
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },

  /* ---- Form Card ---- */
  formCard: {
    marginTop: -4,
    marginHorizontal: spacing.xl,
    backgroundColor: colors.white,
    borderRadius: borderRadius.xl,
    padding: spacing['2xl'],
    gap: spacing.lg,
    // Card shadow
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },

  /* ---- Error ---- */
  errorBox: {
    backgroundColor: colors.error[50],
    borderWidth: 1,
    borderColor: colors.error[200],
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
  },
  errorText: {
    color: colors.error[700],
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    flex: 1,
  },

  /* ---- Forgot Password ---- */
  forgotRow: {
    alignSelf: 'flex-end',
    marginTop: -spacing.sm,
  },
  forgotText: {
    color: colors.primary[600],
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },

  /* ---- Divider ---- */
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.xs,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.slate[200],
  },
  dividerText: {
    marginHorizontal: spacing.md,
    color: colors.slate[400],
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  /* ---- Google Button ---- */
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    borderColor: colors.slate[200],
    backgroundColor: colors.white,
    gap: spacing.md,
  },
  googleG: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.slate[600],
  },
  googleText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.slate[700],
  },

  /* ---- Apple Button ---- */
  appleButton: {
    height: 50,
    width: '100%',
  },

  /* ---- Footer ---- */
  footer: {
    alignItems: 'center',
    paddingTop: spacing['3xl'],
    paddingBottom: spacing['2xl'],
    gap: spacing.md,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  footerText: {
    color: colors.slate[500],
    fontSize: typography.fontSize.sm,
  },
  linkText: {
    color: colors.primary[600],
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },
  poweredBy: {
    color: colors.slate[400],
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.normal,
    letterSpacing: 0.3,
  },
  legalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  legalLink: {
    color: colors.slate[400],
    fontSize: typography.fontSize.xs,
    textDecorationLine: 'underline',
  },
  legalDot: {
    color: colors.slate[300],
    fontSize: typography.fontSize.xs,
  },
});

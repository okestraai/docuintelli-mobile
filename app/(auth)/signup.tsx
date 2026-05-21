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
import { sendSignupOTP, signInWithGoogle, signInWithApple } from '../../src/lib/auth';
import { validatePassword } from '../../src/utils/validatePassword';
import { useAuthStore } from '../../src/store/authStore';
import Button from '../../src/components/ui/Button';
import Input from '../../src/components/ui/Input';
import { colors } from '../../src/theme/colors';
import { typography } from '../../src/theme/typography';
import { spacing, borderRadius } from '../../src/theme/spacing';

export default function SignupScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  const handleSignup = async () => {
    if (!agreedToTerms) {
      setError('You must agree to the Terms and Privacy Policy');
      return;
    }
    if (!email || !password) {
      setError('Please enter email and password');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    const pwError = validatePassword(password);
    if (pwError) {
      setError(pwError);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await sendSignupOTP(email, password);
      router.push({
        pathname: '/(auth)/verify-otp',
        params: { email, flow: 'signup' },
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    setError(null);

    try {
      const data = await signInWithGoogle();
      if (data?.session) {
        useAuthStore.getState().setSession(data.session);
      }
      router.replace('/(tabs)/dashboard');
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
      router.replace('/(tabs)/dashboard');
    } catch (err: unknown) {
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
              <Text style={styles.welcomeTitle}>Create Account</Text>
              <Text style={styles.welcomeSubtitle}>
                Join thousands who trust DocuIntelli AI{'\n'}with their important
                documents
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
              placeholder="Create a strong password"
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              editable={!loading}
              returnKeyType="next"
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

            {/* Confirm Password Input */}
            <Input
              label="Confirm Password"
              value={confirmPassword}
              onChangeText={(text) => {
                setConfirmPassword(text);
                if (error) setError(null);
              }}
              placeholder="Re-enter your password"
              secureTextEntry={!showConfirmPassword}
              autoCapitalize="none"
              editable={!loading}
              returnKeyType="done"
              onSubmitEditing={handleSignup}
              icon={<Lock size={18} color={colors.slate[400]} strokeWidth={1.8} />}
              rightIcon={
                showConfirmPassword ? (
                  <EyeOff size={18} color={colors.slate[500]} strokeWidth={1.8} />
                ) : (
                  <Eye size={18} color={colors.slate[500]} strokeWidth={1.8} />
                )
              }
              onRightIconPress={() => setShowConfirmPassword(!showConfirmPassword)}
            />

            {/* Terms Agreement Checkbox */}
            <TouchableOpacity
              style={styles.checkboxRow}
              onPress={() => setAgreedToTerms(!agreedToTerms)}
              activeOpacity={0.7}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: agreedToTerms }}
              accessibilityLabel="I agree to the Terms of Service and Privacy Policy"
            >
              <View style={[styles.checkbox, agreedToTerms && styles.checkboxChecked]}>
                {agreedToTerms && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={styles.checkboxText}>
                I agree to the{' '}
                <Text style={styles.checkboxLink} onPress={() => router.push({ pathname: '/legal', params: { page: 'terms' } })}>
                  Terms of Service
                </Text>
                {' '}and{' '}
                <Text style={styles.checkboxLink} onPress={() => router.push({ pathname: '/legal', params: { page: 'privacy' } })}>
                  Privacy Policy
                </Text>
              </Text>
            </TouchableOpacity>

            {/* Sign Up Button */}
            <View style={styles.buttonSpacer}>
              <Button
                title="Create Account"
                onPress={handleSignup}
                loading={loading}
                disabled={loading || !agreedToTerms}
                size="lg"
                iconRight={
                  !loading ? (
                    <ArrowRight size={18} color={colors.white} strokeWidth={2} />
                  ) : undefined
                }
              />
            </View>

            {/* Divider */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or continue with</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Google Sign Up */}
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

          {/* Privacy Promise Card */}
          <View style={styles.privacyCard}>
            <LinearGradient
              colors={[...colors.gradient.primaryLight]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.privacyGradient}
            >
              <View style={styles.privacyIconRow}>
                <View style={styles.privacyIconCircle}>
                  <ShieldCheck
                    size={16}
                    color={colors.primary[600]}
                    strokeWidth={2}
                  />
                </View>
                <Text style={styles.privacyTitle}>Your Privacy, Guaranteed</Text>
              </View>
              <Text style={styles.privacyText}>
                All documents are encrypted end-to-end. We never access or share
                your personal information.
              </Text>
            </LinearGradient>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <View style={styles.footerRow}>
              <Text style={styles.footerText}>Already have an account? </Text>
              <TouchableOpacity
                onPress={() => router.push('/(auth)/login')}
                hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
              >
                <Text style={styles.linkText}>Sign in</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.poweredBy}>Powered by Okestra AI Labs</Text>
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

  /* ---- Button Spacer ---- */
  buttonSpacer: {
    marginTop: spacing.xs,
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

  /* ---- Privacy Card ---- */
  privacyCard: {
    marginTop: spacing.xl,
    marginHorizontal: spacing.xl,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.primary[200],
  },
  privacyGradient: {
    padding: spacing.lg,
  },
  privacyIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  privacyIconCircle: {
    width: 28,
    height: 28,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary[100],
    justifyContent: 'center',
    alignItems: 'center',
  },
  privacyTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary[800],
  },
  privacyText: {
    fontSize: typography.fontSize.sm,
    color: colors.primary[700],
    lineHeight: typography.fontSize.sm * typography.lineHeight.relaxed,
    paddingLeft: 36, // align with text after icon
  },

  /* ---- Footer ---- */
  footer: {
    alignItems: 'center',
    paddingTop: spacing['2xl'],
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
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.slate[300],
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkboxChecked: {
    backgroundColor: colors.primary[600],
    borderColor: colors.primary[600],
  },
  checkmark: {
    color: colors.white,
    fontSize: 14,
    fontWeight: typography.fontWeight.bold,
    lineHeight: 16,
  },
  checkboxText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: colors.slate[600],
    lineHeight: 20,
  },
  checkboxLink: {
    color: colors.primary[600],
    textDecorationLine: 'underline',
  },
});

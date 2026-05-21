import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSequence,
  withRepeat,
  Easing,
  interpolate,
} from 'react-native-reanimated';
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';
import { colors } from '../../theme/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const LOGO_SIZE = Math.min(SCREEN_WIDTH * 0.3, 120);

const AnimatedSvg = Animated.createAnimatedComponent(Svg);

/** Shield + checkmark logo matching DocuIntelli brand */
function ShieldLogo({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      <Defs>
        <LinearGradient id="shieldStroke" x1="50" y1="5" x2="50" y2="95" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#047857" />
          <Stop offset="1" stopColor="#065f46" />
        </LinearGradient>
        <LinearGradient id="shieldFill" x1="50" y1="10" x2="50" y2="90" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#d1fae5" />
          <Stop offset="1" stopColor="#a7f3d0" />
        </LinearGradient>
      </Defs>
      {/* Shield body - outer */}
      <Path
        d="M50 5 L88 22 C88 22 90 60 75 78 C65 90 50 95 50 95 C50 95 35 90 25 78 C10 60 12 22 12 22 L50 5Z"
        fill="url(#shieldStroke)"
      />
      {/* Shield body - inner */}
      <Path
        d="M50 12 L82 27 C82 27 84 60 71 75 C63 85 50 89 50 89 C50 89 37 85 29 75 C16 60 18 27 18 27 L50 12Z"
        fill="url(#shieldFill)"
      />
      {/* Checkmark */}
      <Path
        d="M35 52 L46 63 L67 38"
        stroke="#047857"
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

interface AnimatedSplashProps {
  onFinish?: () => void;
}

export default function AnimatedSplash({ onFinish }: AnimatedSplashProps) {
  // Animation values
  const logoScale = useSharedValue(0.3);
  const logoOpacity = useSharedValue(0);
  const textOpacity = useSharedValue(0);
  const textTranslateY = useSharedValue(20);
  const betaOpacity = useSharedValue(0);
  const betaScale = useSharedValue(0.5);
  const pulseScale = useSharedValue(1);
  const shimmerOpacity = useSharedValue(0);
  const overallOpacity = useSharedValue(1);

  useEffect(() => {
    // Hide the native splash screen now that the animated one is mounted
    SplashScreen.hideAsync().catch(() => {});

    // Phase 1: Logo scales in with a bounce (0-600ms)
    logoOpacity.value = withTiming(1, { duration: 400, easing: Easing.out(Easing.cubic) });
    logoScale.value = withSequence(
      withTiming(1.15, { duration: 500, easing: Easing.out(Easing.back(2)) }),
      withTiming(1, { duration: 200, easing: Easing.inOut(Easing.cubic) }),
    );

    // Phase 2: Subtle pulse on logo (loop)
    pulseScale.value = withDelay(
      700,
      withRepeat(
        withSequence(
          withTiming(1.04, { duration: 1200, easing: Easing.inOut(Easing.cubic) }),
          withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.cubic) }),
        ),
        -1,
        true,
      ),
    );

    // Phase 3: Text slides up (400-900ms)
    textOpacity.value = withDelay(400, withTiming(1, { duration: 500 }));
    textTranslateY.value = withDelay(400, withTiming(0, { duration: 500, easing: Easing.out(Easing.cubic) }));

    // Phase 4: Beta badge pops in (700-1000ms)
    betaOpacity.value = withDelay(700, withTiming(1, { duration: 300 }));
    betaScale.value = withDelay(
      700,
      withSequence(
        withTiming(1.2, { duration: 200, easing: Easing.out(Easing.back(3)) }),
        withTiming(1, { duration: 150 }),
      ),
    );

    // Phase 5: Shimmer glow (900-1600ms)
    shimmerOpacity.value = withDelay(
      900,
      withSequence(
        withTiming(0.6, { duration: 400, easing: Easing.inOut(Easing.cubic) }),
        withTiming(0, { duration: 400, easing: Easing.inOut(Easing.cubic) }),
      ),
    );

    // Phase 6: Fade out everything (2200ms+)
    overallOpacity.value = withDelay(
      2200,
      withTiming(0, { duration: 400, easing: Easing.in(Easing.cubic) }),
    );

    // Signal completion
    const timer = setTimeout(() => {
      onFinish?.();
    }, 2700);

    return () => clearTimeout(timer);
  }, []);

  const logoAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: logoScale.value * pulseScale.value }],
    opacity: logoOpacity.value,
  }));

  const textAnimatedStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
    transform: [{ translateY: textTranslateY.value }],
  }));

  const betaAnimatedStyle = useAnimatedStyle(() => ({
    opacity: betaOpacity.value,
    transform: [{ scale: betaScale.value }],
  }));

  const shimmerStyle = useAnimatedStyle(() => ({
    opacity: shimmerOpacity.value,
    transform: [{ scale: interpolate(shimmerOpacity.value, [0, 0.6], [0.8, 1.3]) }],
  }));

  const containerStyle = useAnimatedStyle(() => ({
    opacity: overallOpacity.value,
  }));

  return (
    <Animated.View style={[styles.container, containerStyle]}>
      {/* Shimmer ring behind logo */}
      <Animated.View style={[styles.shimmerRing, shimmerStyle]} />

      {/* Animated logo */}
      <Animated.View style={[styles.logoWrap, logoAnimatedStyle]}>
        <ShieldLogo size={LOGO_SIZE} />
      </Animated.View>

      {/* App name */}
      <Animated.View style={[styles.textWrap, textAnimatedStyle]}>
        <Text style={styles.appName}>DocuIntelli</Text>
        <Text style={styles.appTagline}>AI</Text>
      </Animated.View>

      {/* Beta badge */}
      <Animated.View style={[styles.betaBadge, betaAnimatedStyle]}>
        <Text style={styles.betaText}>BETA</Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 99999,
  },
  shimmerRing: {
    position: 'absolute',
    width: LOGO_SIZE * 1.6,
    height: LOGO_SIZE * 1.6,
    borderRadius: LOGO_SIZE * 0.8,
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: colors.primary[200],
  },
  logoWrap: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textWrap: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 24,
    gap: 8,
  },
  appName: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.slate[900],
    letterSpacing: -0.5,
  },
  appTagline: {
    fontSize: 28,
    fontWeight: '300',
    color: colors.primary[600],
    letterSpacing: -0.5,
  },
  betaBadge: {
    marginTop: 12,
    backgroundColor: colors.primary[500],
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 6,
  },
  betaText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
});

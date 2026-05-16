import React, { useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Platform,
  PanResponder,
} from 'react-native';
import { router, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Upload,
  Eye,
  Search,
  PenTool,
  Heart,
  Wallet,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Minus,
  X,
  Check,
  Target,
} from 'lucide-react-native';
import { useGoalBubbleStore, type BubbleViewState } from '../../store/goalBubbleStore';
import { GOALS, type GoalIcon } from '../../content/goalDefinitions';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing, borderRadius } from '../../theme/spacing';
import { useAuthStore } from '../../store/authStore';

const ICON_MAP: Record<GoalIcon, typeof Upload> = {
  upload: Upload,
  eye: Eye,
  search: Search,
  signature: PenTool,
  heart: Heart,
  wallet: Wallet,
  calendar: CalendarDays,
};

// Tab bar height: paddingTop(10) + icon(22) + gap(4) + label(14) + paddingVertical(4) = ~54
const TAB_BAR_HEIGHT = 54;
const CARD_MARGIN = 16;
const MINIMIZED_SIZE = 44;

// Screens where bubble should be hidden
const HIDDEN_ON = ['/', '/index', '/login', '/signup', '/forgot-password'];
const HIDDEN_PREFIXES = ['/(auth)', '/esign'];

export default function GoalBubbleCard() {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const session = useAuthStore((s) => s.session);

  const activeGoalId = useGoalBubbleStore((s) => s.activeGoalId);
  const completedSteps = useGoalBubbleStore((s) => s.completedSteps);
  const viewState = useGoalBubbleStore((s) => s.viewState);
  const setViewState = useGoalBubbleStore((s) => s.setViewState);
  const dismissGoal = useGoalBubbleStore((s) => s.dismissGoal);
  const ready = useGoalBubbleStore((s) => s.ready);

  const goal = useMemo(
    () => GOALS.find((g) => g.id === activeGoalId) || null,
    [activeGoalId],
  );
  const stepsCompleted = useMemo(
    () => (activeGoalId ? (completedSteps[activeGoalId] || []) : []),
    [activeGoalId, completedSteps],
  );

  // Animations
  const slideAnim = useRef(new Animated.Value(40)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const swipeX = useRef(new Animated.Value(0)).current;

  const bottomPadding = Math.max(insets.bottom, 8);
  const bottomOffset = TAB_BAR_HEIGHT + bottomPadding + CARD_MARGIN;

  // Should hide
  const shouldHide = !session || !ready || !goal || viewState === 'hidden' ||
    HIDDEN_ON.some((p) => pathname === p) ||
    HIDDEN_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  // Mount animation
  useEffect(() => {
    if (!shouldHide) {
      slideAnim.setValue(16);
      fadeAnim.setValue(0);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, tension: 65, friction: 10, useNativeDriver: true }),
      ]).start();
    }
  }, [shouldHide, activeGoalId]); // eslint-disable-line

  // Progress bar animation
  useEffect(() => {
    if (goal) {
      const pct = stepsCompleted.length / goal.steps.length;
      Animated.timing(progressAnim, { toValue: pct, duration: 500, useNativeDriver: false }).start();
    }
  }, [stepsCompleted.length, goal]); // eslint-disable-line

  // Swipe to dismiss
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dx) > 10 && Math.abs(gs.dy) < 20,
        onPanResponderMove: (_, gs) => {
          if (gs.dx > 0) swipeX.setValue(gs.dx);
        },
        onPanResponderRelease: (_, gs) => {
          if (gs.dx > 100) {
            Animated.timing(swipeX, { toValue: 400, duration: 200, useNativeDriver: true }).start(() => {
              swipeX.setValue(0);
              dismissGoal();
            });
          } else {
            Animated.spring(swipeX, { toValue: 0, useNativeDriver: true }).start();
          }
        },
      }),
    [dismissGoal, swipeX],
  );

  if (shouldHide) return null;

  const GoalIcon = ICON_MAP[goal!.icon] || Target;
  const totalSteps = goal!.steps.length;
  const doneCount = stepsCompleted.length;
  const progress = doneCount / totalSteps;

  // Find current step (first incomplete)
  const currentStepIndex = goal!.steps.findIndex((s) => !stepsCompleted.includes(s.id));

  const handleGoNavigate = (route: string) => {
    router.push(route as any);
    setViewState('collapsed');
  };

  // ── Minimized ring ──────────────────────────────────────────
  if (viewState === 'minimized') {
    return (
      <TouchableOpacity
        style={[styles.minimizedRing, { bottom: bottomOffset, right: CARD_MARGIN }]}
        onPress={() => setViewState('collapsed')}
        activeOpacity={0.8}
      >
        {/* Progress ring (simple border approach) */}
        <View style={styles.ringTrack}>
          <View style={[styles.ringFill, { borderColor: colors.primary[500] }]}>
            <Target size={20} color={colors.primary[600]} />
          </View>
        </View>
        {/* Progress text */}
        <View style={styles.ringPercentBadge}>
          <Text style={styles.ringPercentText}>{Math.round(progress * 100)}%</Text>
        </View>
      </TouchableOpacity>
    );
  }

  // ── Celebrating state ──────────────────────────────────────
  if (viewState === 'celebrating') {
    return (
      <Animated.View
        style={[
          styles.card,
          { bottom: bottomOffset, opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
        ]}
      >
        <LinearGradient colors={[...colors.gradient.primary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.accentBar} />
        <View style={styles.celebrateContent}>
          <View style={styles.celebrateIcon}>
            <Check size={32} color={colors.primary[600]} strokeWidth={3} />
          </View>
          <Text style={styles.celebrateTitle}>Goal complete!</Text>
          <Text style={styles.celebrateSubtext}>Great job. Moving to next goal...</Text>
        </View>
      </Animated.View>
    );
  }

  const isExpanded = viewState === 'expanded';

  // ── Card (expanded / collapsed) ─────────────────────────────
  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={[
        styles.card,
        {
          bottom: bottomOffset,
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }, { translateX: swipeX }],
        },
      ]}
    >
      {/* Accent bar */}
      <LinearGradient colors={[...colors.gradient.primary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.accentBar} />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <LinearGradient
            colors={[...colors.gradient.primaryLight]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.iconBox}
          >
            <GoalIcon size={18} color={colors.primary[600]} strokeWidth={2} />
          </LinearGradient>
          <View style={styles.headerText}>
            <Text style={styles.title} numberOfLines={1}>{goal!.title}</Text>
            {!isExpanded && (
              <Text style={styles.description} numberOfLines={1}>{goal!.description}</Text>
            )}
          </View>
        </View>
        <View style={styles.headerButtons}>
          <TouchableOpacity onPress={() => setViewState(isExpanded ? 'collapsed' : 'expanded')} hitSlop={8} style={styles.headerBtn}>
            {isExpanded ? <ChevronDown size={14} color={colors.slate[400]} /> : <ChevronUp size={14} color={colors.slate[400]} />}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setViewState('minimized')} hitSlop={8} style={styles.headerBtn}>
            <Minus size={14} color={colors.slate[400]} />
          </TouchableOpacity>
          <TouchableOpacity onPress={dismissGoal} hitSlop={8} style={styles.headerBtn}>
            <X size={14} color={colors.slate[400]} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Description (expanded only) */}
      {isExpanded && <Text style={styles.descriptionExpanded}>{goal!.description}</Text>}

      {/* Progress bar */}
      <View style={styles.progressRow}>
        <View style={styles.progressTrack}>
          <Animated.View style={[styles.progressFillWrap, {
            width: progressAnim.interpolate({
              inputRange: [0, 1],
              outputRange: ['0%', '100%'],
            }),
          }]}>
            <LinearGradient
              colors={[...colors.gradient.primary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.progressFill}
            />
          </Animated.View>
        </View>
        <Text style={styles.progressCounter}>{doneCount}/{totalSteps}</Text>
      </View>

      {/* Steps (expanded only) */}
      {isExpanded && (
        <View style={styles.stepList}>
          {goal!.steps.map((step, idx) => {
            const isDone = stepsCompleted.includes(step.id);
            const isCurrent = idx === currentStepIndex;

            return (
              <View key={step.id} style={[styles.stepRow, isCurrent && styles.stepRowCurrent]}>
                {/* Icon */}
                {isDone ? (
                  <View style={styles.stepCheckDone}>
                    <Check size={12} color={colors.white} strokeWidth={3} />
                  </View>
                ) : isCurrent ? (
                  <ChevronRight size={16} color={colors.primary[600]} />
                ) : (
                  <View style={styles.stepCircleFuture} />
                )}

                {/* Label + hint */}
                <View style={styles.stepContent}>
                  <Text style={[
                    styles.stepLabel,
                    isDone && styles.stepLabelDone,
                    isCurrent && styles.stepLabelCurrent,
                  ]} numberOfLines={1}>
                    {step.label}
                  </Text>
                  {isCurrent && step.hint && (
                    <Text style={styles.stepHint}>{step.hint}</Text>
                  )}
                </View>

                {/* Go link */}
                {isCurrent && step.navigateTo && (
                  <TouchableOpacity onPress={() => handleGoNavigate(step.navigateTo!)} hitSlop={8}>
                    <Text style={styles.goLink}>Go →</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // ── Card shell ──────────────────────────────────────────────
  card: {
    position: 'absolute',
    left: CARD_MARGIN,
    right: CARD_MARGIN,
    zIndex: 45,
    backgroundColor: colors.white,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.slate[200],
    ...Platform.select({
      ios: { shadowColor: colors.black, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 16 },
      android: { elevation: 8 },
      web: { boxShadow: '0 4px 24px rgba(0,0,0,0.12)' },
    }),
  },
  accentBar: {
    height: 4,
  },

  // ── Header ──────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
    flex: 1,
  },
  iconBox: {
    width: 34,
    height: 34,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.slate[900],
  },
  description: {
    fontSize: 11,
    color: colors.slate[500],
    marginTop: 1,
  },
  descriptionExpanded: {
    fontSize: 11,
    color: colors.slate[500],
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xs,
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  headerBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Progress ────────────────────────────────────────────────
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  progressTrack: {
    flex: 1,
    height: 6,
    backgroundColor: colors.slate[100],
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFillWrap: {
    height: '100%',
    overflow: 'hidden',
    borderRadius: 3,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressCounter: {
    fontSize: 10,
    fontWeight: typography.fontWeight.semibold,
    color: colors.slate[500],
    minWidth: 22,
    textAlign: 'right',
  },

  // ── Step list ───────────────────────────────────────────────
  stepList: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm + 2,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.md,
  },
  stepRowCurrent: {
    backgroundColor: colors.primary[50],
  },
  stepCheckDone: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.primary[500],
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  stepCircleFuture: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: colors.slate[300],
    marginTop: 1,
  },
  stepContent: {
    flex: 1,
  },
  stepLabel: {
    fontSize: typography.fontSize.xs + 1,
    color: colors.slate[600],
  },
  stepLabelDone: {
    color: colors.slate[400],
    textDecorationLine: 'line-through',
  },
  stepLabelCurrent: {
    color: colors.primary[800],
    fontWeight: typography.fontWeight.medium,
  },
  stepHint: {
    fontSize: 10,
    color: colors.primary[600],
    marginTop: 2,
  },
  goLink: {
    fontSize: 10,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary[600],
    marginTop: 2,
  },

  // ── Minimized ring ──────────────────────────────────────────
  minimizedRing: {
    position: 'absolute',
    zIndex: 45,
    width: MINIMIZED_SIZE,
    height: MINIMIZED_SIZE,
    borderRadius: MINIMIZED_SIZE / 2,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.slate[200],
    ...Platform.select({
      ios: { shadowColor: colors.black, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8 },
      android: { elevation: 6 },
      web: { boxShadow: '0 2px 12px rgba(0,0,0,0.1)' },
    }),
  },
  ringTrack: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 3,
    borderColor: colors.slate[200],
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringFill: {
    width: '100%',
    height: '100%',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringPercentBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: colors.primary[600],
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderWidth: 1.5,
    borderColor: colors.white,
  },
  ringPercentText: {
    fontSize: 8,
    fontWeight: typography.fontWeight.bold,
    color: colors.white,
  },

  // ── Celebrating ─────────────────────────────────────────────
  celebrateContent: {
    alignItems: 'center',
    paddingVertical: spacing['2xl'],
    paddingHorizontal: spacing.xl,
  },
  celebrateIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  celebrateTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.slate[900],
    marginBottom: spacing.xs,
  },
  celebrateSubtext: {
    fontSize: typography.fontSize.xs,
    color: colors.slate[500],
  },
});

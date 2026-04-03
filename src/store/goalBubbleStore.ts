import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GOALS, type GoalDefinition } from '../content/goalDefinitions';

const PREFIX = 'docuintelli_goal_';

export interface AppStateInputs {
  documentCount: number;
  hasViewedDocument: boolean;
  currentPlan: string | null;
  currentPage: string;
  globalSearchOpen: boolean;
}

export type BubbleViewState = 'expanded' | 'collapsed' | 'minimized' | 'hidden' | 'celebrating';

interface GoalBubbleState {
  activeGoalId: string | null;
  completedSteps: Record<string, string[]>;
  dismissedGoals: Set<string>;
  completedGoals: Set<string>;
  viewState: BubbleViewState;
  ready: boolean;
  hasInteracted: boolean;

  initialize: () => Promise<void>;
  selectNextGoal: (appState: AppStateInputs) => void;
  completeStep: (goalId: string, stepId: string) => void;
  completeStepById: (stepId: string) => void;
  dismissGoal: () => void;
  resetAllGoals: () => Promise<void>;
  setViewState: (state: BubbleViewState) => void;
  _lastAppState: AppStateInputs | null;
}

function evaluateTrigger(
  trigger: GoalDefinition['trigger'],
  appState: AppStateInputs,
  completedGoals: Set<string>,
): boolean {
  switch (trigger.type) {
    case 'first-login':
      return true;
    case 'after-goal':
      return completedGoals.has(trigger.goalId);
    case 'doc-count':
      return appState.documentCount >= trigger.min;
    case 'plan':
      return appState.currentPlan ? trigger.plans.includes(appState.currentPlan) : false;
    case 'manual':
      return false;
  }
}

export const useGoalBubbleStore = create<GoalBubbleState>((set, get) => ({
  activeGoalId: null,
  completedSteps: {},
  dismissedGoals: new Set(),
  completedGoals: new Set(),
  viewState: 'hidden',
  ready: false,
  hasInteracted: false,
  _lastAppState: null,

  initialize: async () => {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const goalKeys = allKeys.filter((k) => k.startsWith(PREFIX));
      if (goalKeys.length === 0) {
        set({ ready: true });
        return;
      }
      const pairs = await AsyncStorage.multiGet(goalKeys);

      const completedSteps: Record<string, string[]> = {};
      const dismissedGoals = new Set<string>();
      const completedGoals = new Set<string>();

      for (const [key, value] of pairs) {
        if (!value) continue;
        const suffix = key.slice(PREFIX.length);

        if (suffix.startsWith('progress_')) {
          const goalId = suffix.slice('progress_'.length);
          try {
            const data = JSON.parse(value);
            completedSteps[goalId] = data.completedSteps || [];
          } catch {}
        } else if (suffix.startsWith('dismissed_')) {
          dismissedGoals.add(suffix.slice('dismissed_'.length));
        } else if (suffix.startsWith('completed_')) {
          completedGoals.add(suffix.slice('completed_'.length));
        }
      }

      const hasInteracted = (await AsyncStorage.getItem('goalBubble_hasInteracted')) === '1';

      set({ completedSteps, dismissedGoals, completedGoals, ready: true, hasInteracted });
    } catch {
      set({ ready: true });
    }
  },

  selectNextGoal: (appState) => {
    const { dismissedGoals, completedGoals } = get();
    set({ _lastAppState: appState });

    for (const goal of GOALS) {
      if (dismissedGoals.has(goal.id) || completedGoals.has(goal.id)) continue;
      if (evaluateTrigger(goal.trigger, appState, completedGoals)) {
        const { hasInteracted, activeGoalId } = get();
        if (activeGoalId === goal.id) return; // already active
        set({
          activeGoalId: goal.id,
          viewState: hasInteracted ? 'collapsed' : 'expanded',
        });
        return;
      }
    }
    // No eligible goal
    set({ activeGoalId: null, viewState: 'hidden' });
  },

  completeStep: (goalId, stepId) => {
    const { completedSteps, _lastAppState } = get();
    const existing = completedSteps[goalId] || [];
    if (existing.includes(stepId)) return;

    const updated = { ...completedSteps, [goalId]: [...existing, stepId] };
    set({ completedSteps: updated });

    // Persist
    AsyncStorage.setItem(`${PREFIX}progress_${goalId}`, JSON.stringify({ completedSteps: updated[goalId] })).catch(() => {});

    // Check if goal is now complete
    const goal = GOALS.find((g) => g.id === goalId);
    if (goal && goal.steps.every((s) => updated[goalId].includes(s.id))) {
      set({ viewState: 'celebrating' });
      const { completedGoals } = get();
      const newCompleted = new Set(completedGoals);
      newCompleted.add(goalId);
      set({ completedGoals: newCompleted });
      AsyncStorage.setItem(`${PREFIX}completed_${goalId}`, String(Date.now())).catch(() => {});

      // After 2s, advance to next goal
      setTimeout(() => {
        const latestAppState = get()._lastAppState;
        if (latestAppState) {
          get().selectNextGoal(latestAppState);
        }
      }, 2000);
    }
  },

  completeStepById: (stepId) => {
    const { activeGoalId } = get();
    // First try the active goal
    if (activeGoalId) {
      const goal = GOALS.find((g) => g.id === activeGoalId);
      if (goal && goal.steps.some((s) => s.id === stepId)) {
        get().completeStep(activeGoalId, stepId);
        return;
      }
    }
    // Search all goals
    for (const goal of GOALS) {
      if (goal.steps.some((s) => s.id === stepId)) {
        get().completeStep(goal.id, stepId);
        return;
      }
    }
  },

  dismissGoal: () => {
    const { activeGoalId, dismissedGoals, _lastAppState } = get();
    if (!activeGoalId) return;

    const newDismissed = new Set(dismissedGoals);
    newDismissed.add(activeGoalId);
    set({ dismissedGoals: newDismissed });
    AsyncStorage.setItem(`${PREFIX}dismissed_${activeGoalId}`, String(Date.now())).catch(() => {});

    // 300ms delay then select next
    setTimeout(() => {
      if (_lastAppState) {
        get().selectNextGoal(_lastAppState);
      } else {
        set({ activeGoalId: null, viewState: 'hidden' });
      }
    }, 300);
  },

  resetAllGoals: async () => {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const goalKeys = allKeys.filter((k) => k.startsWith(PREFIX) || k === 'goalBubble_hasInteracted');
      if (goalKeys.length > 0) await AsyncStorage.multiRemove(goalKeys);
    } catch {}
    set({
      activeGoalId: null,
      completedSteps: {},
      dismissedGoals: new Set(),
      completedGoals: new Set(),
      viewState: 'hidden',
      ready: false,
      hasInteracted: false,
    });
  },

  setViewState: (viewState) => {
    set({ viewState });
    if (viewState !== 'hidden' && viewState !== 'celebrating') {
      const { hasInteracted } = get();
      if (!hasInteracted) {
        set({ hasInteracted: true });
        AsyncStorage.setItem('goalBubble_hasInteracted', '1').catch(() => {});
      }
    }
  },
}));

import { useGoalBubbleStore } from '../store/goalBubbleStore';

/** Convenience hook for feature screens to complete steps */
export function useGoalBubble() {
  const completeStepById = useGoalBubbleStore((s) => s.completeStepById);
  const dismissGoal = useGoalBubbleStore((s) => s.dismissGoal);
  const activeGoalId = useGoalBubbleStore((s) => s.activeGoalId);
  const resetAllGoals = useGoalBubbleStore((s) => s.resetAllGoals);

  return { completeStepById, dismissGoal, activeGoalId, resetAllGoals };
}

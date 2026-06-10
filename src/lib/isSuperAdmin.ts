import { useAuthStore } from '../store/authStore';

/**
 * Super-admin identity check.
 *
 * Certain feature areas (cloud-storage import, Financial Insights + StockPulse,
 * Action Agent) are restricted to the super admin only — invisible and
 * inaccessible to every other user regardless of plan. The backend enforces
 * this with `requireSuperAdmin`; the app uses this helper to hide entry points
 * and 404 the screens.
 */
export const SUPER_ADMIN_EMAIL = 'okestraai@gmail.com';

export function isSuperAdmin(email?: string | null): boolean {
  return !!email && email.toLowerCase() === SUPER_ADMIN_EMAIL;
}

/** Reactive hook: true when the logged-in user is the super admin. */
export function useIsSuperAdmin(): boolean {
  const user = useAuthStore((s) => s.user);
  return isSuperAdmin(user?.email);
}

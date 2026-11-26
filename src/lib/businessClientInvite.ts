// ── Business-network client-portal invite (mobile) ──────────────────────
// A firm invites a client by sharing a link carrying `?invite=<token>`. The
// client opens it in the SAME consumer app they already use, signs in (or
// signs up) as a normal personal user, and this module quietly links their
// consumer account to the firm's roster via the isolated business API.
//
// Mirrors the consumer web's src/lib/businessClientInvite.ts (capture → stash
// → process-after-auth), ported to mobile with AsyncStorage.
//
// Safety: a no-op unless ALL hold, so it can never affect existing users:
//   1. an `?invite=` token was captured from an incoming deep link, AND
//   2. EXPO_PUBLIC_BUSINESS_API_URL is configured (unset by default), AND
//   3. the user is authenticated.
// Failures are swallowed — invite linking must never block sign-in.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth } from './auth';
import { BUSINESS_FEATURES_ENABLED } from './config';
import { acceptClientInvite, acceptShareInvite } from './businessSharedApi';

const STORAGE_KEY = 'business_pending_invite';

/** Stash an invite token captured from a deep link, to be processed after auth. */
export async function stashClientInvite(token: string): Promise<void> {
  if (!BUSINESS_FEATURES_ENABLED || !token) return;
  try {
    await AsyncStorage.setItem(STORAGE_KEY, token);
  } catch {
    // Storage can be unavailable in locked-down environments — never block boot.
  }
}

/**
 * If an invite was stashed and the user is authenticated, link them to the firm
 * and clear the stash (one-shot). Returns the firm's businessId, or null if there
 * was nothing to do / not configured / not yet authed / the call failed. Non-blocking.
 */
export async function processClientInvite(): Promise<string | null> {
  if (!BUSINESS_FEATURES_ENABLED) return null;

  let token: string | null = null;
  try {
    token = await AsyncStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
  if (!token) return null;

  // Not signed in yet — keep the stash so it processes after login.
  const { data: { session } } = await auth.getSession();
  if (!session) return null;

  const businessId = await acceptClientInvite(token)
    .then((r) => r?.businessId ?? null)
    .catch(() => null);

  // Clear regardless of outcome: a one-shot token shouldn't be retried forever.
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }

  return businessId;
}

// ── Vault share links (?share=<token>) — business DECISIONS D9 ────────────────
// A firm shared a folder or file by email. Same capture → sign in/up → accept flow as the client
// invite above; the server only accepts the address the share was sent to.
const SHARE_KEY = 'business_pending_share';

export async function stashShareInvite(token: string): Promise<void> {
  if (!BUSINESS_FEATURES_ENABLED || !token) return;
  try {
    await AsyncStorage.setItem(SHARE_KEY, token);
  } catch {
    // never block boot
  }
}

/**
 * Accept a stashed share for the signed-in user. Returns the shareId to open, or null when there was
 * nothing to do / not yet signed in / it failed. Kept on a wrong-account refusal (403) so signing in
 * with the invited address can still accept it; cleared otherwise.
 */
export async function processShareInvite(): Promise<string | null> {
  if (!BUSINESS_FEATURES_ENABLED) return null;
  let token: string | null = null;
  try {
    token = await AsyncStorage.getItem(SHARE_KEY);
  } catch {
    return null;
  }
  if (!token) return null;
  const { data: { session } } = await auth.getSession();
  if (!session) return null;
  try {
    const res = await acceptShareInvite(token);
    await AsyncStorage.removeItem(SHARE_KEY).catch(() => {});
    return res.shareId;
  } catch (e: any) {
    if (!/different email/i.test(e?.message ?? '')) await AsyncStorage.removeItem(SHARE_KEY).catch(() => {});
    return null;
  }
}

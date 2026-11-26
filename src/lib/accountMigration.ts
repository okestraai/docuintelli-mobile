import { auth } from './auth';
import { API_BASE } from './config';

/**
 * Has this account been converted to DocuIntelli for Business by our admins? Then its personal app is
 * locked: every data call answers 403 ACCOUNT_MIGRATED. The website shows a "moved to Business"
 * screen; this is the app's equivalent check, run after sign-in, so the person sees why instead of a
 * wall of errors. Mirrors the web (src/App.tsx checkMigrationStatus).
 *
 * The phone app is personal-only (owner decision 2026-11-25): it never switches into the business app.
 * Best-effort — any failure reads as "not migrated", so a network blip never locks anyone out.
 */
export async function getMigration(): Promise<{ businessName: string | null } | null> {
  try {
    const { data: { session } } = await auth.getSession();
    if (!session) return null;
    const res = await fetch(`${API_BASE}/api/auth/me`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      consumer_access_revoked?: boolean;
      migration?: { businessName?: string | null } | null;
    };
    return data.consumer_access_revoked ? { businessName: data.migration?.businessName ?? null } : null;
  } catch {
    return null;
  }
}

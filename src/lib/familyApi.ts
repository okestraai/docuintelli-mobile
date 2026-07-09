/**
 * Family plan members API helpers (mobile).
 * Mirrors the web client; talks to the same /api/family endpoints.
 */
import { auth } from './auth';
import { API_BASE } from './config';
import { getDeviceId } from './deviceId';

async function authHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await auth.getSession();
  if (!session) throw new Error('Not authenticated');
  return {
    Authorization: `Bearer ${session.access_token}`,
    'Content-Type': 'application/json',
    'X-Device-ID': await getDeviceId(),
  };
}

async function apiFetch<T = any>(path: string, opts: RequestInit = {}): Promise<T> {
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE}/api/family${path}`, {
    ...opts,
    headers: { ...headers, ...((opts.headers as Record<string, string>) || {}) },
  });
  const json = await res.json().catch(() => ({ success: false, error: `Request failed (${res.status})` }));
  if (!res.ok || !json.success) throw new Error(json.error || `Request failed (${res.status})`);
  return json;
}

// ── Types ────────────────────────────────────────────────────────

export interface FamilyMember {
  id: string;
  email: string;
  status: 'pending' | 'active' | 'declined' | 'removed';
  memberUserId: string | null;
  invitedAt: string;
  acceptedAt: string | null;
}

export interface FamilyPoolUsage { used: number; limit: number }

export interface FamilyOverview {
  role: 'owner' | 'member' | 'none';
  seatLimit: number;
  seatsUsed: number;
  members: FamilyMember[];
  owner: { id: string; email: string; name: string } | null;
  pool: {
    documents: FamilyPoolUsage;
    uploads: FamilyPoolUsage;
    tokens: FamilyPoolUsage;
  } | null;
}

export interface FamilyInvite {
  id: string;
  owner_id: string;
  invited_at: string;
  owner_email: string;
  owner_name: string;
}

// ── Calls ──────────────────────────────────────────────────────────

export async function getFamily(): Promise<FamilyOverview> {
  const json = await apiFetch<{ success: true } & FamilyOverview>('/');
  const { success, ...overview } = json;
  return overview;
}

export async function inviteFamilyMember(email: string): Promise<FamilyMember> {
  const json = await apiFetch<{ member: FamilyMember }>('/invite', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
  return json.member;
}

export async function getFamilyInvites(): Promise<FamilyInvite[]> {
  const json = await apiFetch<{ invites: FamilyInvite[] }>('/invites');
  return json.invites || [];
}

export async function acceptFamilyInvite(inviteId: string): Promise<void> {
  await apiFetch(`/invites/${inviteId}/accept`, { method: 'POST' });
}

export async function declineFamilyInvite(inviteId: string): Promise<void> {
  await apiFetch(`/invites/${inviteId}/decline`, { method: 'POST' });
}

export async function removeFamilyMember(memberId: string): Promise<void> {
  await apiFetch(`/members/${memberId}`, { method: 'DELETE' });
}

export async function leaveFamily(): Promise<void> {
  await apiFetch('/leave', { method: 'POST' });
}

// ── Business ("firm" network) shared API client ─────────────────────────
// ADDITIVE + INERT BY DEFAULT. Every function throws immediately unless a
// business API base URL is configured via EXPO_PUBLIC_BUSINESS_API_URL
// (BUSINESS_FEATURES_ENABLED). With the base unset — the default, including
// production — no firm request can ever fire, so the consumer app behaves
// exactly as before.
//
// Endpoint list + response shapes mirror the business mobile app's
// src/api/signing.ts EXACTLY. The auth-fetch pattern (authHeaders /
// handleResponse) is copied from ./esignatureApi so firm calls carry the
// same Authorization + X-Device-ID headers the consumer backend expects.

import { auth } from './auth';
import { BUSINESS_API_BASE, BUSINESS_FEATURES_ENABLED } from './config';
import { getDeviceId } from './deviceId';

// ── Types (mirror business-mobile src/api/signing.ts) ───────────────────

/** A signature request addressed to the current user — GET /shared/signatures. */
export interface SignatureForMe {
  id: string;
  businessDocumentId: string;
  documentName: string;
  requestedBy: string; // firm name
  status: string;
  expiresAt: string | null;
  createdAt: string;
  /** True = multi-signer envelope (field-fill ceremony); false = legacy single-signer request. */
  isEnvelope?: boolean;
  canView?: boolean;
  canSign?: boolean;
  canEdit?: boolean;
  /** True only once the finished signed PDF exists — gate the download on this, not status. */
  signedCopyReady?: boolean;
}

/** Whether the current user is on any firm's roster — gates the "From your firms" hub. */
export interface SharedStatus {
  isClient: boolean;
  firms: string[];
}

/** A document a firm has shared with the current user — GET /shared/documents. */
export interface SharedDocument {
  // Null when access comes from the client's own vault (whole-folder view) rather than a per-doc grant.
  grantId: string | null;
  businessDocumentId: string;
  name: string;
  category: string;
  accessLevel: string;
  canView?: boolean;
  canSign?: boolean;
  canEdit?: boolean;
  sharedBy: string; // firm name
  sharedAt: string;
}

/** A document a firm has asked the current user to provide — GET /shared/intake. */
export interface IntakeForMe {
  id: string;
  title: string;
  description: string | null;
  requestedBy: string; // firm name
  dueDate: string | null;
  createdAt: string;
}

export interface SignerField {
  id: string;
  fieldType: string; // signature | initials | full_name | date_signed | text_field | checkbox | title_role | company_name | custom_text
  pageNumber: number;
  xPercent: number;
  yPercent: number;
  widthPercent: number;
  heightPercent: number;
  label: string | null;
  required: boolean;
  value: string | null;
}

export interface EnvelopeForSigner {
  id: string;
  documentName: string;
  requestedBy: string;
  status: string;
  message: string | null;
  canView: boolean;
  myTurn: boolean; // sequential-order gate
  myFields: SignerField[];
  completedFields: Array<SignerField & { signerName: string }>;
}

export type SignatureImageType = 'signature' | 'initials';

/** Paginated list envelope — the business API's convention. */
export interface Page<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

// ── Helpers ─────────────────────────────────────────────────────────────

/** Throw before any network call when firm features are switched off. */
function ensureEnabled(): void {
  if (!BUSINESS_FEATURES_ENABLED) {
    throw new Error('Business features are not enabled');
  }
}

async function authHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await auth.getSession();
  if (!session) throw new Error('User not authenticated');
  const deviceId = await getDeviceId();
  return {
    Authorization: `Bearer ${session.access_token}`,
    'Content-Type': 'application/json',
    'X-Device-ID': deviceId,
  };
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const errData = await res.json().catch(() => ({ error: `Request failed (${res.status})` }));
    const err = new Error(errData.error || errData.message || `Request failed (${res.status})`);
    if (errData.code) (err as any).code = errData.code;
    throw err;
  }
  return res.json();
}

const bizBase = () => `${BUSINESS_API_BASE}/api/business`;
const sigBase = () => `${bizBase()}/shared/signatures`;

// ── Client-portal invite ────────────────────────────────────────────────

/** Accept a firm's client-portal invite, linking this consumer account to the firm's roster. */
export async function acceptClientInvite(token: string): Promise<{ businessId: string }> {
  ensureEnabled();
  const headers = await authHeaders();
  const res = await fetch(`${bizBase()}/clients/accept/${encodeURIComponent(token)}`, {
    method: 'POST',
    headers,
  });
  return handleResponse(res);
}

// ── "From your firms" hub — status / shared documents / intake ────────────

/** Am I on any firm's roster? Gates whether the "From your firms" hub is shown at all. */
export async function getSharedStatus(): Promise<SharedStatus> {
  ensureEnabled();
  const headers = await authHeaders();
  const res = await fetch(`${bizBase()}/shared/status`, { headers });
  return handleResponse(res);
}

/** Documents firms have shared with me, across all firms (paginated). */
export async function listSharedDocuments(params?: { limit?: number; offset?: number }): Promise<Page<SharedDocument>> {
  ensureEnabled();
  const headers = await authHeaders();
  const q = new URLSearchParams({
    limit: String(params?.limit ?? 50),
    offset: String(params?.offset ?? 0),
  });
  const res = await fetch(`${bizBase()}/shared/documents?${q.toString()}`, { headers });
  return handleResponse(res);
}

/** Short-lived signed URL to view a document shared with me (keyed by businessDocumentId). */
export async function getSharedDocumentUrl(businessDocumentId: string): Promise<{ url: string; expiresIn: number }> {
  ensureEnabled();
  const headers = await authHeaders();
  const res = await fetch(`${bizBase()}/shared/documents/${businessDocumentId}/url`, { headers });
  return handleResponse(res);
}

/** Documents firms have asked me to provide (paginated). */
export async function listMyIntake(params?: { limit?: number; offset?: number }): Promise<Page<IntakeForMe>> {
  ensureEnabled();
  const headers = await authHeaders();
  const q = new URLSearchParams({
    limit: String(params?.limit ?? 50),
    offset: String(params?.offset ?? 0),
  });
  const res = await fetch(`${bizBase()}/shared/intake?${q.toString()}`, { headers });
  return handleResponse(res);
}

/** Fulfil an intake request by linking one of MY OWN consumer documents (server checks ownership). */
export async function fulfilIntake(id: string, documentId: string): Promise<{ businessDocumentId: string }> {
  ensureEnabled();
  const headers = await authHeaders();
  const res = await fetch(`${bizBase()}/shared/intake/${id}/fulfil`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ documentId }),
  });
  return handleResponse(res);
}

// ── Firm signing — list / detail ─────────────────────────────────────────

/** Documents awaiting my signature from firms (paginated). */
export async function listMySignatures(params?: { limit?: number; offset?: number }): Promise<Page<SignatureForMe>> {
  ensureEnabled();
  const headers = await authHeaders();
  const q = new URLSearchParams({
    limit: String(params?.limit ?? 50),
    offset: String(params?.offset ?? 0),
  });
  const res = await fetch(`${sigBase()}?${q.toString()}`, { headers });
  return handleResponse(res);
}

/** Load one SINGLE-signer request (id or token). Envelopes use getSignerEnvelope. */
export async function getSignerDetail(ref: string): Promise<SignatureForMe> {
  ensureEnabled();
  const headers = await authHeaders();
  const res = await fetch(`${sigBase()}/${ref}`, { headers });
  return handleResponse(res);
}

export async function getSignerEnvelope(ref: string): Promise<EnvelopeForSigner> {
  ensureEnabled();
  const headers = await authHeaders();
  const res = await fetch(`${sigBase()}/${ref}/envelope`, { headers });
  return handleResponse(res);
}

// ── Single-signer ceremony ───────────────────────────────────────────────

/** Sign a single-signer request (name + method + optional drawn image). */
export async function signSingle(
  ref: string,
  body: { name: string; method: 'typed' | 'drawn'; signatureImage?: string },
): Promise<{ id: string; status: string }> {
  ensureEnabled();
  const headers = await authHeaders();
  const res = await fetch(`${sigBase()}/${ref}/sign`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  return handleResponse(res);
}

/** Decline a single-signer request. */
export async function declineSingle(ref: string): Promise<{ id: string; status: string }> {
  ensureEnabled();
  const headers = await authHeaders();
  const res = await fetch(`${sigBase()}/${ref}/decline`, { method: 'POST', headers });
  return handleResponse(res);
}

// ── Envelope ceremony ────────────────────────────────────────────────────

export async function markSignerViewed(ref: string): Promise<{ ok: true }> {
  ensureEnabled();
  const headers = await authHeaders();
  const res = await fetch(`${sigBase()}/${ref}/view`, { method: 'POST', headers });
  return handleResponse(res);
}

export async function fillSignerField(ref: string, fieldId: string, value: string): Promise<{ ok: true }> {
  ensureEnabled();
  const headers = await authHeaders();
  const res = await fetch(`${sigBase()}/${ref}/fields/${fieldId}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ value }),
  });
  return handleResponse(res);
}

export async function completeSigner(ref: string): Promise<{ status: string }> {
  ensureEnabled();
  const headers = await authHeaders();
  const res = await fetch(`${sigBase()}/${ref}/complete`, { method: 'POST', headers });
  return handleResponse(res);
}

/** Decline to sign an envelope — halts it for all signers. */
export async function declineEnvelope(ref: string): Promise<{ status: string }> {
  ensureEnabled();
  const headers = await authHeaders();
  const res = await fetch(`${sigBase()}/${ref}/envelope-decline`, { method: 'POST', headers });
  return handleResponse(res);
}

// ── Document + saved signature images ────────────────────────────────────

/** Signed, time-limited URL for streaming the document PDF. */
export async function getSignerDocument(ref: string): Promise<{ url: string; expiresIn: number }> {
  ensureEnabled();
  const headers = await authHeaders();
  const res = await fetch(`${sigBase()}/${ref}/document`, { headers });
  return handleResponse(res);
}

/** Short-lived URL to the FINISHED signed PDF — resolves only once the request is completed. */
export async function getSignatureSignedUrl(ref: string): Promise<{ url: string; expiresIn: number }> {
  ensureEnabled();
  const headers = await authHeaders();
  const res = await fetch(`${sigBase()}/${ref}/signed-document`, { headers });
  return handleResponse(res);
}

export async function getSavedSignature(type: SignatureImageType): Promise<{ imageType: string; imageData: string | null }> {
  ensureEnabled();
  const headers = await authHeaders();
  const res = await fetch(`${sigBase()}/images/${type}`, { headers });
  return handleResponse(res);
}

export async function saveSignatureImage(type: SignatureImageType, imageData: string): Promise<{ imageType: string; imageData: string | null }> {
  ensureEnabled();
  const headers = await authHeaders();
  const res = await fetch(`${sigBase()}/images/${type}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ imageData }),
  });
  return handleResponse(res);
}

// ── Field-type groupings for the signer UI ───────────────────────────────

export const SIGNATURE_TYPES = ['signature', 'initials'];
export const TEXT_TYPES = ['full_name', 'text_field', 'title_role', 'company_name', 'custom_text'];

export const fieldLabel = (f: SignerField): string =>
  f.label || f.fieldType.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

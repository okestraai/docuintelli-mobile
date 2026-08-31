// Document obligations API — ported from web (src/lib/obligationsApi.ts)
import { auth } from './auth';
import { API_BASE } from './config';
import { getDeviceId } from './deviceId';

const OBLIGATIONS_BASE = `${API_BASE}/api/obligations`;

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await auth.getSession();
  if (!session) throw new Error('Not authenticated');
  const deviceId = await getDeviceId();
  return {
    Authorization: `Bearer ${session.access_token}`,
    'Content-Type': 'application/json',
    'X-Device-ID': deviceId,
  };
}

/** Carries the server's machine-readable code so callers can branch on it. */
export class ObligationApiError extends Error {
  code?: string;
  status: number;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ObligationApiError';
    this.status = status;
    this.code = code;
  }
}

/** Unwraps the `{ success, data, error }` envelope the obligations API returns. */
async function fetchApi<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${OBLIGATIONS_BASE}${path}`, {
    ...options,
    headers: { ...headers, ...(options.headers as Record<string, string> || {}) },
  });

  const body = await res.json().catch(() => ({ error: 'Request failed' }));

  if (!res.ok) {
    // The plan-cap rejection carries code OBLIGATION_LIMIT_REACHED, which the panel
    // turns into an upgrade prompt rather than a generic error.
    throw new ObligationApiError(body.error || `Request failed with status ${res.status}`, res.status, body.code);
  }

  return body.data as T;
}

// ── Types (mirrored from the API) ───────────────────────────────────────────────

export type ObligationStatus = 'suggested' | 'active' | 'dismissed' | 'completed';

export type ObligationType =
  | 'renewal' | 'payment' | 'cancellation' | 'filing' | 'inspection' | 'submission' | 'other';

export interface Obligation {
  id: string;
  document_id: string;
  document_name: string;
  document_category: string;
  title: string;
  description: string | null;
  obligation_type: ObligationType;
  /** What the model proposed. Display-only — never fires a reminder. */
  suggested_due_date: string | null;
  suggested_due_text: string | null;
  /** User-confirmed date. The only date the reminder cron reads. */
  due_date: string | null;
  due_date_source: 'user' | 'extracted';
  pre_notice_days: number[];
  status: ObligationStatus;
  /** Verbatim quote from the document, shown so the user can check our work. */
  source_excerpt: string | null;
  confidence: number | null;
  decided_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ObligationListResult {
  items: Obligation[];
  meta: { total: number; limit: number; offset: number; hasMore: boolean };
}

export interface ObligationSummary {
  suggested: number;
  active: number;
  overdue: number;
  due_this_week: number;
  completed: number;
}

export interface ObligationConfig {
  preNoticePresets: { days: number; label: string }[];
  maxPreNoticeEntries: number;
  obligationTypes: ObligationType[];
  maxActive: number;
  activeUsed: number;
}

export interface ListObligationsParams {
  status?: ObligationStatus[];
  documentId?: string;
  dueBefore?: string;
  limit?: number;
  offset?: number;
}

// ── Endpoints ───────────────────────────────────────────────────────────────────

export async function listObligations(params: ListObligationsParams = {}): Promise<ObligationListResult> {
  const search = new URLSearchParams();
  if (params.status?.length) search.set('status', params.status.join(','));
  if (params.documentId) search.set('document_id', params.documentId);
  if (params.dueBefore) search.set('due_before', params.dueBefore);
  if (params.limit != null) search.set('limit', String(params.limit));
  if (params.offset != null) search.set('offset', String(params.offset));
  const qs = search.toString();
  return fetchApi<ObligationListResult>(qs ? `?${qs}` : '');
}

export function getObligationSummary(): Promise<ObligationSummary> {
  return fetchApi<ObligationSummary>('/summary');
}

export function getObligationConfig(): Promise<ObligationConfig> {
  return fetchApi<ObligationConfig>('/config');
}

/** Turn a suggestion into a live reminder. */
export function acceptObligation(id: string, dueDate: string, preNoticeDays: number[]): Promise<Obligation> {
  return fetchApi<Obligation>(`/${id}/accept`, {
    method: 'POST',
    body: JSON.stringify({ due_date: dueDate, pre_notice_days: preNoticeDays }),
  });
}

export function dismissObligation(id: string): Promise<Obligation> {
  return fetchApi<Obligation>(`/${id}/dismiss`, { method: 'POST' });
}

export function completeObligation(id: string): Promise<Obligation> {
  return fetchApi<Obligation>(`/${id}/complete`, { method: 'POST' });
}

export function reopenObligation(id: string): Promise<Obligation> {
  return fetchApi<Obligation>(`/${id}/reopen`, { method: 'POST' });
}

export interface ObligationUpdate {
  title?: string;
  description?: string | null;
  obligation_type?: ObligationType;
  due_date?: string;
  pre_notice_days?: number[];
}

export function updateObligation(id: string, updates: ObligationUpdate): Promise<Obligation> {
  return fetchApi<Obligation>(`/${id}`, { method: 'PATCH', body: JSON.stringify(updates) });
}

export function deleteObligation(id: string): Promise<{ deleted: boolean }> {
  return fetchApi<{ deleted: boolean }>(`/${id}`, { method: 'DELETE' });
}

/** Re-scan a document — for documents uploaded before this feature existed. */
export function extractObligations(documentId: string): Promise<{ extracted: number; inserted: number }> {
  return fetchApi<{ extracted: number; inserted: number }>(`/documents/${documentId}/extract`, { method: 'POST' });
}

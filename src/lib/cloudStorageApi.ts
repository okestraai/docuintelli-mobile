/**
 * Mobile cloud storage API client.
 * Mirrors web src/lib/cloudStorageApi.ts but uses expo-web-browser for OAuth
 * and AsyncStorage-based auth for API calls.
 */
import { Platform } from 'react-native';
import { auth } from './auth';
import { API_BASE } from './config';
import { getDeviceId } from './deviceId';

const BACKEND_URL = `${API_BASE}/api/cloud-storage`;

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

async function fetchApi<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${BACKEND_URL}${path}`, {
    ...options,
    headers: { ...headers, ...(options.headers as Record<string, string>) },
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ error: 'Request failed' }));
    const err: any = new Error(errorData.error || `Request failed with status ${res.status}`);
    err.needsReconnect = errorData.needsReconnect;
    throw err;
  }

  return res.json();
}

// ── Types ──────────────────────────────────────────────────────────────────

export interface CloudProvider {
  name: string;
  displayName: string;
  connected: boolean;
  email?: string;
}

export interface CloudFile {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  modifiedTime: string;
  iconUrl?: string;
  isFolder: boolean;
}

export interface ImportFileRequest {
  fileId: string;
  name: string;
  category: string;
  expirationDate?: string;
}

export interface ImportResult {
  fileId: string;
  documentId?: string;
  status: 'imported' | 'already_imported' | 'skipped' | 'failed';
  error?: string;
}

// ── API Functions ──────────────────────────────────────────────────────────

/** Get list of supported cloud providers and connection status */
export async function getCloudProviders(): Promise<CloudProvider[]> {
  const data = await fetchApi<{ providers: CloudProvider[] }>('/providers');
  return data.providers;
}

/**
 * Build the OAuth connect URL for a provider.
 * On web, navigates directly. On native, returns the URL for use in a WebView.
 */
export async function getConnectUrl(provider: string): Promise<string | null> {
  const { data: { session } } = await auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const token = encodeURIComponent(session.access_token);
  // On native (iOS & Android), redirect to the app's custom scheme so the
  // system browser / in-app WebView recognises the callback and returns to the app.
  // Web still uses the web vault URL.
  const redirectTarget = Platform.OS === 'web'
    ? `${API_BASE}/vault?cloud_connected=${provider}`
    : `docuintelli://vault?cloud_connected=${provider}`;
  const redirectTo = encodeURIComponent(redirectTarget);
  const connectUrl = `${BACKEND_URL}/${provider}/connect?token=${token}&redirect_to=${redirectTo}`;

  if (Platform.OS === 'web') {
    window.location.href = connectUrl;
    return null;
  }

  return connectUrl;
}

/** Disconnect a cloud storage provider */
export async function disconnectProvider(provider: string): Promise<void> {
  await fetchApi(`/${provider}/disconnect`, { method: 'DELETE' });
}

/** Get a valid OAuth access token for the Google Picker */
export async function getPickerToken(provider: string): Promise<string> {
  const data = await fetchApi<{ accessToken: string }>(`/${provider}/picker-token`);
  return data.accessToken;
}

/** Browse files in connected cloud storage */
export async function browseCloudFiles(
  provider: string,
  folderId?: string,
  pageToken?: string
): Promise<{ files: CloudFile[]; nextPageToken?: string }> {
  const params = new URLSearchParams();
  if (folderId) params.set('folderId', folderId);
  if (pageToken) params.set('pageToken', pageToken);
  const qs = params.toString();
  return fetchApi(`/${provider}/files${qs ? `?${qs}` : ''}`);
}

/** Import selected files from cloud storage */
export async function importCloudFiles(
  provider: string,
  files: ImportFileRequest[],
  pickerAccessToken?: string
): Promise<ImportResult[]> {
  const data = await fetchApi<{ imported: ImportResult[] }>(`/${provider}/import`, {
    method: 'POST',
    body: JSON.stringify({ files, pickerAccessToken }),
  });
  return data.imported;
}

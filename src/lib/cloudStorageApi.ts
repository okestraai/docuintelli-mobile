/**
 * Mobile cloud storage API client.
 * Mirrors web src/lib/cloudStorageApi.ts but uses expo-web-browser for OAuth
 * and AsyncStorage-based auth for API calls.
 */
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
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
 * Initiate OAuth connection flow using expo-web-browser.
 * Opens the provider's auth page in an in-app browser,
 * waits for the redirect back, and returns the connected provider name.
 */
export async function connectProvider(provider: string): Promise<string | null> {
  const { data: { session } } = await auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const token = encodeURIComponent(session.access_token);

  // On native: use the app's custom scheme (docuintelli://) so the browser
  // redirects back into the app after OAuth completes.
  // On web: use the web vault URL.
  const appRedirectUri = Platform.OS === 'web'
    ? `${API_BASE}/vault`
    : makeRedirectUri({ scheme: 'docuintelli', path: 'vault' });

  const redirectTo = encodeURIComponent(appRedirectUri);
  const connectUrl = `${BACKEND_URL}/${provider}/connect?token=${token}&redirect_to=${redirectTo}`;

  const result = await WebBrowser.openAuthSessionAsync(connectUrl, appRedirectUri);

  if (result.type === 'success' && result.url) {
    // Parse the returned URL to check for cloud_connected param
    try {
      const url = new URL(result.url);
      const connected = url.searchParams.get('cloud_connected');
      return connected || provider;
    } catch {
      // If URL parsing fails (custom scheme), try manual parsing
      const match = result.url.match(/cloud_connected=([^&]+)/);
      return match ? match[1] : provider;
    }
  }

  return null;
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

/**
 * Notifications API client — mobile client for the unified notification system.
 * Same API serves web and mobile.
 */
import { auth } from './auth';
import { API_BASE } from './config';
import { getDeviceId } from './deviceId';

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  metadata: Record<string, any>;
  read: boolean;
  channel_id: string;
  created_at: string;
}

async function fetchNotificationsApi<T>(path: string, options?: RequestInit): Promise<T> {
  const { data: { session } } = await auth.getSession();
  if (!session) throw new Error('Not authenticated');
  const deviceId = await getDeviceId();

  const res = await fetch(`${API_BASE}/api/notifications${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
      'X-Device-ID': deviceId,
      ...((options?.headers as Record<string, string>) || {}),
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `API error: ${res.status}`);
  }
  return res.json();
}

/** Get notifications (paginated, unread first) */
export async function getNotifications(limit = 50, offset = 0): Promise<{
  notifications: AppNotification[];
  total: number;
}> {
  return fetchNotificationsApi(`?limit=${limit}&offset=${offset}`);
}

/** Get count of unread notifications */
export async function getUnreadCount(): Promise<{ count: number }> {
  return fetchNotificationsApi('/unread-count');
}

/** Mark a single notification as read */
export async function markAsRead(id: string): Promise<void> {
  await fetchNotificationsApi(`/${id}/read`, { method: 'POST' });
}

/** Mark all notifications as read */
export async function markAllAsRead(): Promise<void> {
  await fetchNotificationsApi('/read-all', { method: 'POST' });
}

/** Dismiss (soft-delete) a notification */
export async function dismissNotification(id: string): Promise<void> {
  await fetchNotificationsApi(`/${id}`, { method: 'DELETE' });
}

/**
 * useNotifications — polls the notifications API for unread count and notifications.
 * Pauses polling when app is backgrounded or user is unauthenticated.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { AppState } from 'react-native';
import { useAuthStore } from '../store/authStore';
import {
  getNotifications,
  getUnreadCount,
  markAsRead as apiMarkAsRead,
  markAllAsRead as apiMarkAllAsRead,
  dismissNotification as apiDismiss,
  AppNotification,
} from '../lib/notificationsApi';

const POLL_INTERVAL = 60_000; // 60 seconds

export function useNotifications() {
  const session = useAuthStore((s) => s.session);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchUnreadCount = useCallback(async () => {
    if (!session) return;
    try {
      const { count } = await getUnreadCount();
      setUnreadCount(count);
    } catch { /* skip */ }
  }, [session]);

  const refresh = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    try {
      const [countData, notifData] = await Promise.all([
        getUnreadCount(),
        getNotifications(50),
      ]);
      setUnreadCount(countData.count);
      setNotifications(notifData.notifications);
    } catch { /* skip */ }
    setLoading(false);
  }, [session]);

  const markAsRead = useCallback(async (id: string) => {
    try {
      await apiMarkAsRead(id);
      setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch { /* skip */ }
  }, []);

  const markAllAsRead = useCallback(async () => {
    try {
      await apiMarkAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch { /* skip */ }
  }, []);

  const dismiss = useCallback(async (id: string) => {
    try {
      await apiDismiss(id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch { /* skip */ }
  }, []);

  // Start/stop polling based on auth and app state
  useEffect(() => {
    if (!session) {
      setUnreadCount(0);
      setNotifications([]);
      return;
    }

    // Initial fetch
    fetchUnreadCount();

    // Poll on interval
    intervalRef.current = setInterval(fetchUnreadCount, POLL_INTERVAL);

    // Pause when backgrounded, resume when foregrounded
    const appStateListener = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        fetchUnreadCount();
        if (!intervalRef.current) {
          intervalRef.current = setInterval(fetchUnreadCount, POLL_INTERVAL);
        }
      } else {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      }
    });

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      appStateListener.remove();
    };
  }, [session, fetchUnreadCount]);

  return {
    unreadCount,
    notifications,
    loading,
    refresh,
    markAsRead,
    markAllAsRead,
    dismiss,
  };
}

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import { auth } from '../lib/auth';
import Constants from 'expo-constants';

// Configure notification handling (skip on web — not supported)
if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

export async function registerForPushNotificationsAsync(): Promise<string | null> {
  // Push notifications are not supported on web
  if (Platform.OS === 'web') return null;

  // Push notifications only work on physical devices
  if (!Device.isDevice) {
    console.log('Push notifications require a physical device');
    return null;
  }

  // Set up Android notification channel
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#059669',
    });

    await Notifications.setNotificationChannelAsync('documents', {
      name: 'Document Alerts',
      description: 'Expiration reminders and document updates',
      importance: Notifications.AndroidImportance.HIGH,
    });

    await Notifications.setNotificationChannelAsync('billing', {
      name: 'Billing',
      description: 'Payment and subscription updates',
      importance: Notifications.AndroidImportance.DEFAULT,
    });

    await Notifications.setNotificationChannelAsync('security', {
      name: 'Security Alerts',
      description: 'Login alerts and security notifications',
      importance: Notifications.AndroidImportance.HIGH,
    });

    await Notifications.setNotificationChannelAsync('stockpulse', {
      name: 'StockPulse Alerts',
      description: 'Stock score changes and trading alerts',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  // Check existing permissions
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  // Request permissions if not granted
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('Push notification permission not granted');
    return null;
  }

  // Get Expo push token
  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: projectId || undefined,
    });
    const token = tokenData.data;

    // Store token via API
    const { data: { session } } = await auth.getSession();
    if (session) {
      const { API_BASE } = require('../lib/config');
      await fetch(`${API_BASE}/api/user/push-token`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token }),
      });
    }

    return token;
  } catch (error) {
    console.error('Failed to get push token:', error);
    return null;
  }
}

export function setupNotificationListeners() {
  // Handle notification received while app is foregrounded
  const receivedSubscription = Notifications.addNotificationReceivedListener((notification) => {
    console.log('Notification received:', notification.request.content.title);
  });

  // Handle notification tap (app was in background or killed)
  const responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data;
    const type = data?.type as string;

    // Route based on notification type, then data fields
    const typeRoutes: Record<string, string> = {
      esign_received: '/esign/sign-auth',
      esign_completed: '/esign/sign-auth',
      esign_declined: '/esign/sign-auth',
      esign_reminder: '/esign/sign-auth',
      emergency_invite: '/emergency-invite',
      emergency_request: '/shared-with-me',
      emergency_granted: '/shared-with-me',
      emergency_denied: '/shared-with-me',
      billing_trial_ending: '/billing',
      billing_payment_failed: '/billing',
      billing_plan_changed: '/billing',
      stockpulse_conviction: '/stockpulse',
      stockpulse_score_alert: '/stockpulse',
      stockpulse_simulator_pnl: '/stockpulse',
      stockpulse_backtest_done: '/stockpulse',
      life_event_milestone: '/life-events',
      cloud_import_done: '/(tabs)/vault',
      security_new_device: '/settings/devices',
      security_password_changed: '/settings/security',
      shared_doc_access: '/shared-with-me',
      engagement_digest: '/audit',
    };

    if (data?.documentId) {
      router.push({ pathname: '/document/[id]', params: { id: data.documentId as string } });
    } else if (type && typeRoutes[type]) {
      router.push(typeRoutes[type] as any);
    } else if (data?.route) {
      router.push(data.route as any);
    }
  });

  return () => {
    receivedSubscription.remove();
    responseSubscription.remove();
  };
}

export async function clearPushToken() {
  try {
    const { data: { session } } = await auth.getSession();
    if (session) {
      const { API_BASE } = require('../lib/config');
      await fetch(`${API_BASE}/api/user/push-token`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
    }
  } catch (error) {
    console.error('Failed to clear push token:', error);
  }
}

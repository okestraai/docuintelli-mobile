/**
 * Mobile analytics — screen view tracking
 *
 * Fire-and-forget: never blocks UI, never throws.
 */

import { Platform } from 'react-native';
import { auth } from './auth';
import { API_BASE } from './config';
import { getDeviceId } from './deviceId';

export async function trackScreenView(screenName: string): Promise<void> {
  try {
    const { data: { session } } = await auth.getSession();
    if (!session?.access_token) return;

    const deviceId = await getDeviceId();

    fetch(`${API_BASE}/api/analytics/event`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
        'X-Device-ID': deviceId,
      },
      body: JSON.stringify({
        event: 'screen_view',
        properties: {
          screen: screenName,
          platform: Platform.OS, // 'ios' | 'android' | 'web'
        },
      }),
    }).catch(() => {});
  } catch {
    // Never throw — analytics must not disrupt the app
  }
}

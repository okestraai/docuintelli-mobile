/**
 * Device-limit interceptor
 *
 * The backend soft-blocks devices over a plan's limit and replies 403 with
 * `code: DEVICE_LIMIT_EXCEEDED` or `DEVICE_BLOCKED` (see the web
 * subscriptionGuard). Rather than teach every api helper about these codes, we
 * patch the global `fetch` once at boot and notify subscribers. A single
 * top-level <DeviceLimitModal> listens and explains the block to the user.
 */

import { API_BASE } from './config';
import { getDeviceId } from './deviceId';

export interface DeviceLimitDetail {
  code: 'DEVICE_LIMIT_EXCEEDED' | 'DEVICE_BLOCKED';
  plan?: string;
  limit?: number;
  current?: number;
  message?: string;
}

type Listener = (detail: DeviceLimitDetail) => void;

const listeners = new Set<Listener>();

/** Subscribe to device-limit blocks. Returns an unsubscribe function. */
export function onDeviceLimit(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

let installed = false;

// A blocked device can only fix the block, by removing a device or upgrading.
export function canUseWhileBlocked(pathname: string): boolean {
  return pathname === '/settings/devices' || pathname === '/billing';
}

// Every call to our API says which device it came from, so the device limit can't be skipped.
export function withDeviceId(args: any[], apiBase: string, deviceId: string): any[] {
  const [input, init] = args;
  const url = typeof input === 'string' ? input : input?.url ?? String(input);
  if (!url.startsWith(`${apiBase}/api/`)) return args;
  const headers = new Headers(init?.headers ?? input?.headers);
  if (!headers.has('X-Device-ID')) headers.set('X-Device-ID', deviceId);
  return [input, { ...init, headers }];
}

export function installDeviceLimitInterceptor(): void {
  if (installed || typeof global.fetch !== 'function') return;
  installed = true;

  // RN's global fetch has overloaded signatures that don't compose with a
  // simple wrapper type, so we thread args through as-is via `any`.
  const g = global as unknown as { fetch: (...args: any[]) => Promise<Response> };
  const originalFetch = g.fetch.bind(global);

  g.fetch = async (...args: any[]): Promise<Response> => {
    const deviceId = await getDeviceId().catch(() => null);
    const res = await originalFetch(...(deviceId ? withDeviceId(args, API_BASE, deviceId) : args));

    // Only JSON 403s can carry a device code. Gate on content-type so we never
    // clone/buffer upload or binary error bodies (also sidesteps flaky RN
    // Response.clone on non-JSON bodies), and clone so callers still read theirs.
    const contentType = res.status === 403 ? res.headers.get('content-type') || '' : '';
    if (contentType.includes('application/json') && typeof res.clone === 'function') {
      try {
        const data = await res.clone().json();
        if (data?.code === 'DEVICE_LIMIT_EXCEEDED' || data?.code === 'DEVICE_BLOCKED') {
          listeners.forEach((fn) => fn(data as DeviceLimitDetail));
        }
      } catch {
        // Malformed JSON — not one of ours, ignore.
      }
    }

    return res;
  };
}

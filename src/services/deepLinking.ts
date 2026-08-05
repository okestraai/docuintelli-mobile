import { router } from 'expo-router';
import * as Linking from 'expo-linking';
import { APP_SCHEME, BUSINESS_FEATURES_ENABLED } from '../lib/config';
import { stashClientInvite, processClientInvite } from '../lib/businessClientInvite';

/**
 * Deep linking is primarily handled by Expo Router automatically via file-based routing.
 * URLs like docuintelli://document/abc123 map to app/document/[id]/index.tsx.
 *
 * This service handles special non-route URLs like Stripe callbacks.
 */

export function handleDeepLink(url: string) {
  const parsed = Linking.parse(url);

  // ── Business ("firm") network deep links — inert unless configured ──
  // These arrive as query params on ANY incoming URL (incl. the bare root,
  // which has no path), so they must be handled before the !path early-return.
  if (BUSINESS_FEATURES_ENABLED) {
    const invite = parsed.queryParams?.invite;
    if (typeof invite === 'string' && invite) {
      // Stash, then attempt immediately (in case the user is already signed in).
      // Non-blocking, one-shot, failures swallowed.
      stashClientInvite(invite).then(() => processClientInvite()).catch(() => {});
    }

    const sign = parsed.queryParams?.sign;
    if (typeof sign === 'string' && sign) {
      // Default to the single-signer screen; it probes for envelopes itself.
      router.push({ pathname: '/firm-sign/[ref]', params: { ref: sign } } as any);
      return;
    }
  }

  if (!parsed.path) return;

  // Normalize path — HTTPS Universal Links have a leading slash, custom scheme links don't
  const path = parsed.path.replace(/^\//, '');

  // Handle Stripe checkout callbacks
  if (path === 'checkout/success') {
    // Stripe checkout completed — navigate to billing with success state
    router.replace('/billing');
    return;
  }

  if (path === 'checkout/cancel') {
    router.replace('/billing');
    return;
  }

  // Handle password reset
  if (path === 'reset-password') {
    const token = parsed.queryParams?.token as string | undefined;
    if (token) {
      router.push({ pathname: '/(auth)/forgot-password', params: { token } });
    }
    return;
  }

  // Handle emergency access invite
  if (path === 'emergency-invite') {
    const token = parsed.queryParams?.token as string | undefined;
    if (token) {
      router.push({ pathname: '/emergency-invite', params: { token } });
    }
    return;
  }

  // Handle cloud storage OAuth callback (safety net if openAuthSessionAsync misses it)
  if (path === 'vault' && parsed.queryParams?.cloud_connected) {
    router.replace('/(tabs)/vault');
    return;
  }

  // Handle e-signature signing links (docuintelli://sign/{token} or https://docuintelli.com/sign/{token})
  if (path.startsWith('sign/')) {
    const signingToken = path.replace('sign/', '');
    if (signingToken) {
      router.push({ pathname: '/esign/sign/[token]', params: { token: signingToken } });
    }
    return;
  }

  // For all other deep links, Expo Router handles them automatically
}

export function setupDeepLinkListener() {
  // Listen for incoming deep links while app is running
  const subscription = Linking.addEventListener('url', ({ url }) => {
    handleDeepLink(url);
  });

  // Check if app was opened via deep link
  Linking.getInitialURL().then((url) => {
    if (url) {
      handleDeepLink(url);
    }
  });

  return () => {
    subscription.remove();
  };
}

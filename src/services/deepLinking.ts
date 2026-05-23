import { router } from 'expo-router';
import * as Linking from 'expo-linking';
import { APP_SCHEME } from '../lib/config';

/**
 * Deep linking is primarily handled by Expo Router automatically via file-based routing.
 * URLs like docuintelli://document/abc123 map to app/document/[id]/index.tsx.
 *
 * This service handles special non-route URLs like Stripe callbacks.
 */

export function handleDeepLink(url: string) {
  const parsed = Linking.parse(url);

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

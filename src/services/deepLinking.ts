import * as Linking from 'expo-linking';
import { APP_SCHEME, BUSINESS_FEATURES_ENABLED } from '../lib/config';
import { stashClientInvite, processClientInvite } from '../lib/businessClientInvite';

const WEB_HOSTS = new Set(['docuintelli.com', 'www.docuintelli.com']);

const firstSegment = (rest: string) => rest.split('/')[0];

/**
 * The screen an incoming link opens. Expo Router calls this through app/+native-intent.tsx for
 * every link, so a website link never lands on "Unmatched Route".
 *
 * `/sign/<token>` is this app's own e-signature; `/firm-sign/<token>` is a firm's request, a
 * different system with a different token. They must never share a screen.
 */
export function routeForLink(url: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }

  const isWeb = parsed.protocol === 'https:' || parsed.protocol === 'http:';
  if (isWeb && !WEB_HOSTS.has(parsed.hostname)) return '/';
  // Dev-client and other schemes are not ours to rewrite.
  if (!isWeb && parsed.protocol !== `${APP_SCHEME}:`) return url;

  // docuintelli://sign/x puts "sign" in the host; https puts it in the path.
  const path = isWeb
    ? parsed.pathname.replace(/^\/+/, '')
    : [parsed.hostname, parsed.pathname.replace(/^\/+/, '')].filter(Boolean).join('/');
  const q = parsed.searchParams;
  const token = q.get('token');

  // Old e-signature emails used the web's hash route.
  const hashSign = parsed.hash.match(/^#\/sign\/([^/?#]+)/)?.[1];
  if (hashSign) return `/esign/sign/${hashSign}`;

  if (path.startsWith('sign/')) {
    const t = firstSegment(path.slice('sign/'.length));
    return t ? `/esign/sign/${t}` : '/';
  }
  if (path.startsWith('firm-sign/')) {
    const t = firstSegment(path.slice('firm-sign/'.length));
    return t ? `/firm-sign/${t}` : '/';
  }
  // Older firm links: /?sign=<token>.
  const legacySign = q.get('sign');
  if (BUSINESS_FEATURES_ENABLED && legacySign) return `/firm-sign/${encodeURIComponent(legacySign)}`;

  if (path === 'checkout/success' || path === 'checkout/cancel') return '/billing';
  if (path === 'reset-password') return '/forgot-password';
  if (path === 'emergency-invite') {
    return token ? `/emergency-invite?token=${encodeURIComponent(token)}` : '/';
  }
  if (path === 'vault') return '/vault';
  // Client invites are taken by handleDeepLink; the user just lands on home.
  if (path.startsWith('invite/')) return '/';

  // Any other website page has no screen here.
  if (isWeb) return '/';

  // App-scheme links (docuintelli://document/abc) map to routes as they are.
  return `/${path}${parsed.search}`;
}

/** The invite token in a link, from /invite/<token> or the older ?invite=<token>. */
export function inviteTokenOf(url: string): string | null {
  try {
    const u = new URL(url);
    const fromPath = u.pathname.match(/^\/invite\/([^/?#]+)/)?.[1];
    return fromPath ? decodeURIComponent(fromPath) : u.searchParams.get('invite');
  } catch {
    return null;
  }
}

/** Side effects only; routing is in routeForLink. */
export function handleDeepLink(url: string) {
  if (!BUSINESS_FEATURES_ENABLED) return;
  const invite = inviteTokenOf(url);
  if (invite) {
    // Stash, then try at once in case the user is already signed in. Failures are swallowed.
    stashClientInvite(invite).then(() => processClientInvite()).catch(() => {});
  }
}

export function setupDeepLinkListener() {
  const subscription = Linking.addEventListener('url', ({ url }) => {
    handleDeepLink(url);
  });

  Linking.getInitialURL().then((url) => {
    if (url) handleDeepLink(url);
  });

  return () => {
    subscription.remove();
  };
}

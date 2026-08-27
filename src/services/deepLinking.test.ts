import { handleDeepLink } from './deepLinking';
import { router } from 'expo-router';

/**
 * Which ceremony a signing link opens.
 *
 * This app has TWO unrelated signing systems and they must never be confused:
 *
 *  - `/sign/<token>` — this app's own e-signature product → `/esign/sign/[token]`
 *  - `/firm-sign/<token>` — a signature request raised by a firm in the Business Network →
 *    `/firm-sign/[ref]`, a different screen resolving a different kind of token
 *
 * Firm links used to arrive as `/?sign=<token>`: root with a query, which iOS Universal Links
 * cannot claim without claiming `/` and handing this app every marketing page. So on iOS they
 * always opened Safari. The path form fixes that — and the prefix is what stops it landing in the
 * wrong ceremony.
 */

jest.mock('expo-router', () => ({ router: { push: jest.fn(), replace: jest.fn() } }));
jest.mock('expo-linking', () => ({
  parse: (url: string) => {
    const u = new URL(url);
    const queryParams: Record<string, string> = {};
    u.searchParams.forEach((v, k) => (queryParams[k] = v));
    return { path: u.pathname === '/' ? null : u.pathname, queryParams };
  },
}));
jest.mock('../lib/config', () => ({ APP_SCHEME: 'docuintelli', BUSINESS_FEATURES_ENABLED: true }));
jest.mock('../lib/businessClientInvite', () => ({
  stashClientInvite: jest.fn().mockResolvedValue(undefined),
  processClientInvite: jest.fn().mockResolvedValue(undefined),
}));

const push = router.push as jest.Mock;

beforeEach(() => jest.clearAllMocks());

describe('handleDeepLink — firm signature requests', () => {
  it('opens the FIRM ceremony for /firm-sign/<token>', () => {
    handleDeepLink('https://docuintelli.com/firm-sign/tok-123');
    expect(push).toHaveBeenCalledWith({ pathname: '/firm-sign/[ref]', params: { ref: 'tok-123' } });
  });

  it('opens THIS app\'s own ceremony for /sign/<token>', () => {
    handleDeepLink('https://docuintelli.com/sign/esign-token');
    expect(push).toHaveBeenCalledWith({
      pathname: '/esign/sign/[token]',
      params: { token: 'esign-token' },
    });
  });

  it('never sends a firm token to the e-signature screen', () => {
    // The whole reason the firm link is NOT '/sign/<token>'. `'firm-sign/x'.startsWith('sign/')` is
    // false, but a future refactor to a looser match would silently reroute every firm signer.
    handleDeepLink('https://docuintelli.com/firm-sign/tok-123');
    expect(push).toHaveBeenCalledTimes(1);
    expect(push.mock.calls[0][0].pathname).not.toContain('esign');
  });

  it('still handles the legacy ?sign= shape, for links already sent', () => {
    handleDeepLink('https://docuintelli.com/?sign=tok-legacy');
    expect(push).toHaveBeenCalledWith({
      pathname: '/firm-sign/[ref]',
      params: { ref: 'tok-legacy' },
    });
  });

  it('ignores a bare /firm-sign/ with no token', () => {
    handleDeepLink('https://docuintelli.com/firm-sign/');
    expect(push).not.toHaveBeenCalled();
  });

  it('leaves unrelated paths to expo-router', () => {
    handleDeepLink('https://docuintelli.com/vault');
    expect(push).not.toHaveBeenCalled();
  });
});

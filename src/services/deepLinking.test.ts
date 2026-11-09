import { handleDeepLink, inviteTokenOf, routeForLink } from './deepLinking';
import { stashClientInvite } from '../lib/businessClientInvite';

// `/sign/<token>` is this app's own e-signature; `/firm-sign/<token>` is a firm's request. A firm
// token must never reach the e-signature screen.

jest.mock('expo-linking', () => ({ addEventListener: jest.fn(), getInitialURL: jest.fn() }));
jest.mock('../lib/config', () => ({ APP_SCHEME: 'docuintelli', BUSINESS_FEATURES_ENABLED: true }));
jest.mock('../lib/businessClientInvite', () => ({
  stashClientInvite: jest.fn().mockResolvedValue(undefined),
  processClientInvite: jest.fn().mockResolvedValue(undefined),
}));

beforeEach(() => jest.clearAllMocks());

describe('routeForLink — website links', () => {
  it.each([
    ['https://docuintelli.com/sign/esign-token', '/esign/sign/esign-token'],
    ['https://docuintelli.com/#/sign/old-token', '/esign/sign/old-token'],
    ['https://docuintelli.com/firm-sign/tok-123', '/firm-sign/tok-123'],
    ['https://docuintelli.com/?sign=tok-legacy', '/firm-sign/tok-legacy'],
    ['https://docuintelli.com/emergency-invite?token=e1', '/emergency-invite?token=e1'],
    ['https://docuintelli.com/reset-password?token=r1', '/forgot-password'],
    ['https://docuintelli.com/vault', '/vault'],
    ['https://docuintelli.com/vault?cloud_connected=1', '/vault'],
    ['https://docuintelli.com/invite/inv-1', '/'],
    ['https://www.docuintelli.com/sign/w1', '/esign/sign/w1'],
  ])('%s opens %s', (url, route) => {
    expect(routeForLink(url)).toBe(route);
  });

  it.each([
    'https://docuintelli.com/pricing',
    'https://docuintelli.com/hosted/invoice/x',
    'https://docuintelli.com/',
    'https://docuintelli.com/sign/',
    'https://docuintelli.com/firm-sign/',
    'https://evil.example/sign/x',
    'https://docuintelli.com/sign/..%2F..%2Fapi%2Fx',
    'https://docuintelli.com/firm-sign/a%2Fb',
    'https://docuintelli.com/#/sign/..%2Fx',
    'https://docuintelli.com/?sign=a/b',
  ])('%s opens home instead of an error screen', (url) => {
    expect(routeForLink(url)).toBe('/');
  });

  it('never sends a firm token to the e-signature screen', () => {
    expect(routeForLink('https://docuintelli.com/firm-sign/tok-123')).not.toContain('esign');
  });
});

describe('routeForLink — app links', () => {
  it.each([
    ['docuintelli://sign/t1', '/esign/sign/t1'],
    ['docuintelli://checkout/success', '/billing'],
    ['docuintelli://checkout/cancel', '/billing'],
    ['docuintelli://document/abc', '/document/abc'],
    ['docuintelli://document/abc?tab=info', '/document/abc?tab=info'],
  ])('%s opens %s', (url, route) => {
    expect(routeForLink(url)).toBe(route);
  });

  it('leaves other schemes and plain paths alone', () => {
    const dev = 'exp+docuintelli://expo-development-client/?url=http%3A%2F%2F10.0.2.2%3A8081';
    expect(routeForLink(dev)).toBe(dev);
    expect(routeForLink('/document/abc')).toBe('/document/abc');
  });
});

describe('client invites', () => {
  it('reads the token from /invite/<token> and the older ?invite=', () => {
    expect(inviteTokenOf('https://docuintelli.com/invite/inv-1')).toBe('inv-1');
    expect(inviteTokenOf('https://docuintelli.com/?invite=inv-2')).toBe('inv-2');
    expect(inviteTokenOf('https://docuintelli.com/vault')).toBeNull();
  });

  it('stashes the invite when a link arrives', () => {
    handleDeepLink('https://docuintelli.com/invite/inv-1');
    expect(stashClientInvite).toHaveBeenCalledWith('inv-1');
  });

  it('does nothing for other links', () => {
    handleDeepLink('https://docuintelli.com/sign/t');
    expect(stashClientInvite).not.toHaveBeenCalled();
  });
});

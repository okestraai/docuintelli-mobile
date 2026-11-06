jest.mock('./config', () => ({ API_BASE: 'https://api.test' }));
jest.mock('./deviceId', () => ({ getDeviceId: jest.fn() }));

import { withDeviceId } from './deviceLimitInterceptor';

const sent = (args: any[]) => new Headers(args[1]?.headers).get('X-Device-ID');

describe('withDeviceId', () => {
  it('adds the device to a call with no device header, keeping its other headers', () => {
    const out = withDeviceId(['https://api.test/api/documents', { method: 'DELETE', headers: { Authorization: 'Bearer t' } }], 'https://api.test', 'phone');
    expect(sent(out)).toBe('phone');
    expect(new Headers(out[1].headers).get('Authorization')).toBe('Bearer t');
    expect(out[1].method).toBe('DELETE');
  });

  it('adds it to a call with no options', () => {
    expect(sent(withDeviceId(['https://api.test/api/documents'], 'https://api.test', 'phone'))).toBe('phone');
  });

  it('leaves a device already sent alone', () => {
    expect(sent(withDeviceId(['https://api.test/api/documents', { headers: { 'X-Device-ID': 'other' } }], 'https://api.test', 'phone'))).toBe('other');
  });

  it('never sends the device to another site', () => {
    const args = ['https://other.test/api/documents', { headers: {} }];
    expect(withDeviceId(args, 'https://api.test', 'phone')).toBe(args);
    expect(withDeviceId(['https://api.test.evil.test/api/x'], 'https://api.test', 'phone')[1]).toBeUndefined();
  });
});

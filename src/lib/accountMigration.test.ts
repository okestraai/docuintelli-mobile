jest.mock('./config', () => ({ API_BASE: 'https://api.test' }));
jest.mock('./auth', () => ({
  auth: { getSession: jest.fn().mockResolvedValue({ data: { session: { access_token: 'jwt' } } }) },
}));

import { getMigration } from './accountMigration';

const respond = (body: unknown, ok = true) =>
  jest.spyOn(globalThis, 'fetch' as any).mockResolvedValue({ ok, json: async () => body } as any);

afterEach(() => jest.restoreAllMocks());

describe('getMigration — is this account locked to the business app?', () => {
  it('reports a converted account and the firm it moved to', async () => {
    respond({ consumer_access_revoked: true, migration: { businessName: 'Hoops and Wheels' } });
    await expect(getMigration()).resolves.toEqual({ businessName: 'Hoops and Wheels' });
  });

  it('a personal account (including staff of a firm) is not locked', async () => {
    respond({ consumer_access_revoked: false, migration: null });
    await expect(getMigration()).resolves.toBeNull();
  });

  it('a failed check never locks anyone out', async () => {
    jest.spyOn(globalThis, 'fetch' as any).mockRejectedValue(new Error('offline'));
    await expect(getMigration()).resolves.toBeNull();
    respond({ error: 'x' }, false);
    await expect(getMigration()).resolves.toBeNull();
  });
});

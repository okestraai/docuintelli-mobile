import { clearOfflineCache } from './offlineCache';

const mockStore = new Map<string, string>([['docuintelli_cache_documents', '[{"name":"User A private file"}]'], ['docuintelli_device_id', 'phone']]);

jest.mock('@react-native-async-storage/async-storage', () => ({
  getAllKeys: async () => [...mockStore.keys()],
  multiRemove: async (keys: string[]) => keys.forEach((key) => mockStore.delete(key)),
}));

describe('clearOfflineCache', () => {
  it("removes the last person's saved lists and leaves the device ID", async () => {
    await clearOfflineCache();
    expect(mockStore.has('docuintelli_cache_documents')).toBe(false);
    expect(mockStore.get('docuintelli_device_id')).toBe('phone');
  });
});

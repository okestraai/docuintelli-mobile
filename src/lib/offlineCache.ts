import AsyncStorage from '@react-native-async-storage/async-storage';

export const CACHE_PREFIX = 'docuintelli_cache_';

// Saved lists belong to whoever was signed in, so they go when that person does.
export async function clearOfflineCache(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const cacheKeys = keys.filter((key) => key.startsWith(CACHE_PREFIX));
    if (cacheKeys.length > 0) await AsyncStorage.multiRemove(cacheKeys);
  } catch (error) {
    console.error('Failed to clear cache:', error);
  }
}

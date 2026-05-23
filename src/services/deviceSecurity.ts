import { Platform } from 'react-native';
import * as Device from 'expo-device';
import { Directory } from 'expo-file-system/next';

/**
 * Lightweight jailbreak/root detection.
 * Returns true if the device appears compromised.
 * Never returns a false positive — errors default to false.
 */
export async function checkDeviceCompromised(): Promise<boolean> {
  // Never warn on simulators/emulators — they are expected dev environments
  if (!Device.isDevice) return false;

  if (Platform.OS === 'android') {
    try {
      const rooted = await (Device as any).isRootedExperimentallyAsync?.();
      return rooted === true;
    } catch {
      return false;
    }
  }

  if (Platform.OS === 'ios') {
    // Probe for common jailbreak indicators
    const jailbreakPaths = [
      '/private/var/lib/apt',
      '/Applications/Cydia.app',
      '/private/var/stash',
    ];
    for (const path of jailbreakPaths) {
      try {
        const dir = new Directory(path);
        if (dir.exists) return true;
      } catch {
        // Access denied = sandboxed (expected on clean device)
      }
    }
    return false;
  }

  return false;
}

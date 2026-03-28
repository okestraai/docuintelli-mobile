// Lazy accessor for Dimensions — avoids triggering native module init
// during Expo web static export (which crashes with __fbBatchedBridgeConfig error).
import { Platform } from 'react-native';

function getDimensions() {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return { width: window.innerWidth, height: window.innerHeight };
  }
  if (Platform.OS === 'web') {
    // SSR / static export fallback
    return { width: 390, height: 844 };
  }
  // Native — lazy require to avoid module-scope crash
  const Dimensions = require('react-native/Libraries/Utilities/Dimensions').default;
  return Dimensions.get('window');
}

export const getScreenWidth = (): number => getDimensions().width;
export const getScreenHeight = (): number => getDimensions().height;
export const getScreenDimensions = () => getDimensions();

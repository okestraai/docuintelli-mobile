import { Platform } from 'react-native';

// All config values come from EXPO_PUBLIC_* environment variables.
// In development, these are loaded from .env by Expo's built-in dotenv support.
// In production EAS builds, set them via EAS Secrets or eas.json env blocks.

export const API_BASE = __DEV__ && Platform.OS === 'web'
  ? (process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:5000')
  : (process.env.EXPO_PUBLIC_API_BASE_URL || 'https://docuintelli.com');

export const STRIPE_STARTER_PRICE_ID = process.env.EXPO_PUBLIC_STRIPE_STARTER_PRICE_ID || '';
export const STRIPE_PRO_PRICE_ID = process.env.EXPO_PUBLIC_STRIPE_PRO_PRICE_ID || '';
export const STRIPE_STARTER_YEARLY_PRICE_ID = process.env.EXPO_PUBLIC_STRIPE_STARTER_YEARLY_PRICE_ID || '';
export const STRIPE_PRO_YEARLY_PRICE_ID = process.env.EXPO_PUBLIC_STRIPE_PRO_YEARLY_PRICE_ID || '';

export const GOOGLE_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || '';
export const GOOGLE_PICKER_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_PICKER_API_KEY || '';

// Deep link scheme for Stripe callbacks, password reset, etc.
export const APP_SCHEME = 'docuintelli';

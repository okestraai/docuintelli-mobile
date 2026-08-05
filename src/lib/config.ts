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

// ── Business ("firm") network — additive, inert-by-default ────────────
// Base URL for the isolated business API. Mirrors the consumer web's
// VITE_BUSINESS_API_URL gating: when unset (the default, incl. production),
// BUSINESS_FEATURES_ENABLED is false and every firm feature is a no-op.
export const BUSINESS_API_BASE = process.env.EXPO_PUBLIC_BUSINESS_API_URL || '';
export const BUSINESS_FEATURES_ENABLED = BUSINESS_API_BASE.length > 0;

// Deep link scheme for Stripe callbacks, password reset, etc.
export const APP_SCHEME = 'docuintelli';

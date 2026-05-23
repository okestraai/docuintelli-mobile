/**
 * RevenueCat IAP Service
 *
 * Wraps the RevenueCat SDK for native in-app purchases (iOS/Android).
 * Web continues to use Stripe checkout — this module is only active on native.
 */

import { Platform } from 'react-native';
import Constants from 'expo-constants';
import Purchases, {
  type PurchasesOfferings,
  type PurchasesPackage,
  type CustomerInfo,
  LOG_LEVEL,
} from 'react-native-purchases';

const RC_APPLE_KEY = process.env.EXPO_PUBLIC_RC_APPLE_KEY || '';
const RC_GOOGLE_KEY = process.env.EXPO_PUBLIC_RC_GOOGLE_KEY || '';

let isConfigured = false;

// Detect Expo Go — RevenueCat native store is unavailable in Expo Go
const isExpoGo = Constants.appOwnership === 'expo';

// ─── Init ────────────────────────────────────────────────────────────────────

/**
 * Configure RevenueCat SDK. Call once on app boot (after auth).
 * Skips silently in Expo Go since native store APIs are unavailable.
 * @param appUserId - Your backend user ID to link purchases to accounts
 */
export async function configureRevenueCat(appUserId?: string): Promise<void> {
  if (Platform.OS === 'web' || isConfigured || isExpoGo) return;

  const apiKey = Platform.OS === 'ios' ? RC_APPLE_KEY : RC_GOOGLE_KEY;
  if (!apiKey) {
    console.warn('[IAP] No RevenueCat API key for platform:', Platform.OS);
    return;
  }

  if (__DEV__) {
    Purchases.setLogLevel(LOG_LEVEL.DEBUG);
  }

  try {
    await Promise.resolve(Purchases.configure({ apiKey, appUserID: appUserId || undefined }));
    isConfigured = true;
  } catch (err) {
    console.warn('[IAP] Failed to configure RevenueCat:', err);
  }
}

/**
 * Log in a user to RevenueCat (call after auth login).
 * Links their purchases to your backend user ID.
 */
export async function loginUser(appUserId: string): Promise<CustomerInfo> {
  if (Platform.OS === 'web') throw new Error('IAP not available on web');
  const { customerInfo } = await Purchases.logIn(appUserId);
  return customerInfo;
}

/**
 * Log out the current RevenueCat user (call on sign out).
 */
export async function logoutUser(): Promise<void> {
  if (Platform.OS === 'web') return;
  if (!isConfigured) return;
  await Purchases.logOut();
}

// ─── Offerings & Packages ────────────────────────────────────────────────────

/**
 * Fetch available offerings (the default offering contains our 4 packages).
 */
export async function getOfferings(): Promise<PurchasesOfferings> {
  if (Platform.OS === 'web') throw new Error('IAP not available on web');
  return Purchases.getOfferings();
}

/**
 * Get a specific package from the default offering.
 */
export async function getPackage(
  packageId: 'starter_monthly' | 'starter_yearly' | 'pro_monthly' | 'pro_yearly'
): Promise<PurchasesPackage | null> {
  const offerings = await getOfferings();
  const current = offerings.current;
  if (!current) return null;
  return current.availablePackages.find((p) => p.identifier === packageId) || null;
}

/**
 * Get localized price string for a package (e.g., "$9.99", "€8,99").
 */
export async function getLocalizedPrice(
  packageId: 'starter_monthly' | 'starter_yearly' | 'pro_monthly' | 'pro_yearly'
): Promise<string | null> {
  const pkg = await getPackage(packageId);
  if (!pkg) return null;
  return pkg.product.priceString;
}

// ─── Purchases ───────────────────────────────────────────────────────────────

/**
 * Purchase a subscription package. Returns updated CustomerInfo on success.
 */
export async function purchasePackage(pkg: PurchasesPackage): Promise<CustomerInfo> {
  if (Platform.OS === 'web') throw new Error('IAP not available on web');
  const { customerInfo } = await Purchases.purchasePackage(pkg);
  return customerInfo;
}

/**
 * Convenience: purchase by package ID string.
 */
export async function purchaseByPackageId(
  packageId: 'starter_monthly' | 'starter_yearly' | 'pro_monthly' | 'pro_yearly'
): Promise<CustomerInfo> {
  const pkg = await getPackage(packageId);
  if (!pkg) throw new Error(`Package "${packageId}" not found in offerings`);
  return purchasePackage(pkg);
}

// ─── Restore & Status ────────────────────────────────────────────────────────

/**
 * Restore purchases (Apple requires a visible "Restore Purchases" button).
 */
export async function restorePurchases(): Promise<CustomerInfo> {
  if (Platform.OS === 'web') throw new Error('IAP not available on web');
  return Purchases.restorePurchases();
}

/**
 * Get current customer info (entitlements, subscription status).
 */
export async function getCustomerInfo(): Promise<CustomerInfo> {
  if (Platform.OS === 'web') throw new Error('IAP not available on web');
  return Purchases.getCustomerInfo();
}

/**
 * Check if the user has an active entitlement.
 */
export async function hasEntitlement(
  entitlementId: 'docuintelli_starter' | 'docuintelli_pro'
): Promise<boolean> {
  const info = await getCustomerInfo();
  return info.entitlements.active[entitlementId]?.isActive ?? false;
}

/**
 * Get the user's current active plan based on entitlements.
 */
export async function getActivePlan(): Promise<'free' | 'starter' | 'pro'> {
  try {
    const info = await getCustomerInfo();
    if (info.entitlements.active['docuintelli_pro']?.isActive) return 'pro';
    if (info.entitlements.active['docuintelli_starter']?.isActive) return 'starter';
    return 'free';
  } catch {
    return 'free';
  }
}

/**
 * Add a listener for customer info changes (subscription updates).
 * Returns an unsubscribe function.
 */
export function onCustomerInfoUpdated(
  callback: (info: CustomerInfo) => void
): () => void {
  if (Platform.OS === 'web' || !isConfigured) return () => {};
  try {
    const listener = Purchases.addCustomerInfoUpdateListener(callback);
    return () => listener?.remove?.();
  } catch {
    return () => {};
  }
}

/**
 * Get the subscription management URL for the current platform.
 */
export function getManageSubscriptionsUrl(): string {
  if (Platform.OS === 'ios') {
    return 'https://apps.apple.com/account/subscriptions';
  }
  return 'https://play.google.com/store/account/subscriptions';
}

export const isNativeIAP = Platform.OS !== 'web';

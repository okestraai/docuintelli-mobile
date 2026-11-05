import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE } from './config';
import { applyPlanLimits, type LivePlanLimits } from './planLimits';

/** What the server says right now. The last answer is kept, so an offline phone still shows it. */
export interface AppConfig {
  plans: LivePlanLimits;
  maxUploadMB: number;
  familySeats: number;
}

export const DEFAULT_MAX_UPLOAD_MB = 50;
export const DEFAULT_FAMILY_SEATS = 5;

const STORAGE_KEY = 'docuintelli.appConfig';
const MAX_AGE_MS = 5 * 60 * 1000;
let loading: Promise<AppConfig | null> | null = null;
let loadedAt = 0;
let latest: AppConfig | null = null;

function isConfig(value: unknown): value is AppConfig {
  return !!value && typeof (value as AppConfig).maxUploadMB === 'number' && !!(value as AppConfig).plans;
}

function use(config: AppConfig): AppConfig {
  latest = config;
  applyPlanLimits(config.plans);
  return config;
}

async function lastAnswer(): Promise<AppConfig | null> {
  if (latest) return latest;
  try {
    const saved = await AsyncStorage.getItem(STORAGE_KEY);
    const parsed = saved ? JSON.parse(saved) : null;
    return isConfig(parsed) ? use(parsed) : null;
  } catch {
    return null;
  }
}

async function fetchConfig(): Promise<AppConfig | null> {
  try {
    const res = await fetch(`${API_BASE}/api/config`);
    const config = res.ok ? await res.json() : null;
    if (isConfig(config)) {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(config)).catch(() => {});
      return use(config);
    }
  } catch {
    // Offline: the last answer below is the best there is.
  }
  loading = null;
  return lastAnswer();
}

export function useAppConfig(): AppConfig | null {
  const [config, setConfig] = useState(latest);
  useEffect(() => {
    let active = true;
    if (!loading || Date.now() - loadedAt > MAX_AGE_MS) {
      loadedAt = Date.now();
      loading = fetchConfig();
    }
    loading.then((next) => {
      if (active && next) setConfig(next);
    });
    return () => {
      active = false;
    };
  }, []);
  return config;
}

/** Puts the real largest-file size into text written with the default. */
export function withFileSize(text: string, maxUploadMB = DEFAULT_MAX_UPLOAD_MB): string {
  return text.replace(/\b50 ?MB\b(?! of storage)/g, (found) => (found.includes(' ') ? `${maxUploadMB} MB` : `${maxUploadMB}MB`));
}

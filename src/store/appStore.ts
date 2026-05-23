import { create } from 'zustand';

interface AppState {
  isOnline: boolean;
  isLocked: boolean;
  isCompromised: boolean;
  /** Route to navigate to after login (e.g. from email signing links) */
  pendingRedirect: string | null;
  pendingRedirectParams: Record<string, string> | null;
  setOnline: (online: boolean) => void;
  setLocked: (locked: boolean) => void;
  setCompromised: (compromised: boolean) => void;
  setPendingRedirect: (route: string, params?: Record<string, string>) => void;
  consumePendingRedirect: () => { route: string; params: Record<string, string> } | null;
}

export const useAppStore = create<AppState>((set, get) => ({
  isOnline: true,
  isLocked: false,
  isCompromised: false,
  pendingRedirect: null,
  pendingRedirectParams: null,
  setOnline: (online) => set({ isOnline: online }),
  setLocked: (locked) => set({ isLocked: locked }),
  setCompromised: (compromised) => set({ isCompromised: compromised }),
  setPendingRedirect: (route, params) => set({ pendingRedirect: route, pendingRedirectParams: params || null }),
  consumePendingRedirect: () => {
    const { pendingRedirect, pendingRedirectParams } = get();
    if (!pendingRedirect) return null;
    set({ pendingRedirect: null, pendingRedirectParams: null });
    return { route: pendingRedirect, params: pendingRedirectParams || {} };
  },
}));

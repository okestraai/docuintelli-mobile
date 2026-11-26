import { useEffect } from 'react';
import { AppState } from 'react-native';
import { leaveSharePresence, sendSharePresence } from '../../lib/businessSharedApi';

/** How often an open shared item reports in. The server counts someone live for 45s after a beat. */
export const PRESENCE_BEAT_MS = 20_000;

/**
 * While a shared folder or file is open, tell the firm where we are (business DECISIONS D9): the
 * folder being browsed or the file being viewed. Pauses while the app is in the background, and
 * says goodbye on close so the firm's "live now" clears at once. Best-effort — never blocks viewing.
 */
export function useSharePresence(shareId: string | null, where: { documentId?: string; folderId?: string }): void {
  const { documentId, folderId } = where;
  useEffect(() => {
    if (!shareId) return;
    const beat = () => {
      if (AppState.currentState !== 'active') return;
      sendSharePresence({ shareId, documentId, folderId }).catch(() => {});
    };
    beat();
    const timer = setInterval(beat, PRESENCE_BEAT_MS);
    const sub = AppState.addEventListener('change', (s) => s === 'active' && beat());
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [shareId, documentId, folderId]);

  useEffect(() => {
    if (!shareId) return;
    return () => {
      leaveSharePresence(shareId).catch(() => {});
    };
  }, [shareId]);
}

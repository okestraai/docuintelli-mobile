import { routeForLink } from '../src/services/deepLinking';

// Expo Router asks this file which screen each incoming link should open.
export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  return routeForLink(path);
}

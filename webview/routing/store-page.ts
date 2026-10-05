import type { GameContext } from "../domain/action-item";

const APP_PATH = /^\/app\/(\d+)(?:\/|$)/i;

/**
 * Checks if the current location is a Steam Store game page, and extracts
 * the associated appId, clean game title, and URL context.
 */
export function getSteamStoreGameContext(location: Location): GameContext | undefined {
  if (location.hostname !== "store.steampowered.com") {
    return undefined;
  }

  const appId = APP_PATH.exec(location.pathname)?.[1];
  if (!appId) {
    return undefined;
  }

  return {
    appId,
    title: document.title.replace(/\s+on\s+Steam\s*$/i, ""),
    url: location.href,
  };
}

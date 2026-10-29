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

/**
 * Determines whether the Steam client is currently running in Big Picture Mode / GamepadUI.
 */
export function isBigPictureMode(): boolean {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  if (/Valve Steam (Gamepad|Tenfoot)/i.test(ua) || /GamepadUI/i.test(ua) || /SteamDeck/i.test(ua)) {
    return true;
  }

  if (typeof document !== "undefined" && typeof document.cookie === "string") {
    if (/bIsGamepadUI=1/i.test(document.cookie) || /strResponsiveView=1/i.test(document.cookie)) {
      return true;
    }
  }

  const docClass = (typeof document !== "undefined" && document.documentElement?.className) || "";
  const bodyClass = (typeof document !== "undefined" && document.body?.className) || "";
  const href = typeof window !== "undefined" ? window.location?.href || "" : "";
  if (
    docClass.includes("GamepadUI") ||
    bodyClass.includes("gamepadui") ||
    href.includes("tenfoot") ||
    href.includes("gamepadui")
  ) {
    return true;
  }

  return false;
}

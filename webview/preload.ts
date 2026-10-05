import { ActionsController } from "./application/actions-controller";
import type { ActionItem, GameContext } from "./domain/action-item";
import { ActionPopup } from "./ui/action-popup";
import { AddToLibraryOverlay } from "./ui/add-to-library-overlay";
import { RemoveFromLibraryOverlay } from "./ui/remove-from-library-overlay";
import { NativeActionButton } from "./ui/native-action-button";
import { SettingsOverlay } from "./ui/settings-overlay";

// Set to true to show console logs in CEF DevTools, or false to hide/silence immediately
const ENABLE_LOGS = true;

function logInfo(...args: unknown[]): void {
  if (ENABLE_LOGS) {
    console.log(...args);
  }
}

function logWarn(...args: unknown[]): void {
  if (ENABLE_LOGS) {
    console.warn(...args);
  }
}

function logError(...args: unknown[]): void {
  if (ENABLE_LOGS) {
    console.error(...args);
  }
}

declare const backend: {
  getInstalledAppIds?: () => Promise<string[]>;
  hasGameLua?: (appid: string) => Promise<boolean>;
  addToLibrary?: (appId: string, title?: string) => Promise<string>;
  removeFromLibrary?: (appId: string, title?: string) => Promise<string>;
};

const CONTROLLER_KEY = "__steamActionsController__";

interface SteamActionsWindow extends Window {
  [CONTROLLER_KEY]?: ActionsController;
}

const installedAppIds = new Set<string>();

async function syncInstalledGames(): Promise<void> {
  logInfo("[steam-actions:webview] syncInstalledGames() running...");
  if (typeof backend === "undefined") {
    logWarn("[steam-actions:webview] 'backend' global is not defined yet!");
    return;
  }
  if (typeof backend.getInstalledAppIds !== "function") {
    logWarn("[steam-actions:webview] 'backend.getInstalledAppIds' is not a function:", backend);
    return;
  }

  try {
    logInfo("[steam-actions:webview] Calling backend.getInstalledAppIds()...");
    const appIds = await backend.getInstalledAppIds();
    logInfo("[steam-actions:webview] backend.getInstalledAppIds() returned:", appIds);
    if (Array.isArray(appIds)) {
      installedAppIds.clear();
      for (const id of appIds) {
        installedAppIds.add(String(id));
      }
      logInfo(`[steam-actions:webview] Cached ${installedAppIds.size} installed app IDs in memory.`);
    }
  } catch (error) {
    logError("[steam-actions:webview] Could not sync installed games from backend:", error);
  }
}

async function checkGameLua(appId: string): Promise<boolean> {
  logInfo(`[steam-actions:webview] Navigated to game: checking hasGameLua for appId ${appId}...`);
  if (typeof backend === "undefined" || typeof backend.hasGameLua !== "function") {
    logWarn("[steam-actions:webview] backend.hasGameLua is unavailable!", typeof backend);
    return installedAppIds.has(appId);
  }

  try {
    const exists = await backend.hasGameLua(appId);
    logInfo(`[steam-actions:webview] backend.hasGameLua('${appId}') result:`, exists);
    if (exists) {
      installedAppIds.add(appId);
    } else {
      installedAppIds.delete(appId);
    }
    return exists;
  } catch (error) {
    logError(`[steam-actions:webview] Failed checking hasGameLua for appId ${appId}:`, error);
  }
  return installedAppIds.has(appId);
}

const settingsOverlay = new SettingsOverlay();
const addToLibraryOverlay = new AddToLibraryOverlay((context) => {
  logInfo(`[steam-actions:webview] Successfully added appId ${context.appId} to library; updating local cache.`);
  installedAppIds.add(context.appId);
});
const removeFromLibraryOverlay = new RemoveFromLibraryOverlay((context) => {
  logInfo(`[steam-actions:webview] Successfully removed appId ${context.appId} from library; updating local cache.`);
  installedAppIds.delete(context.appId);
});

function resolveActions(context: GameContext): ActionItem[] {
  const isInstalled = installedAppIds.has(context.appId);
  logInfo(`[steam-actions:webview] Resolving actions for appId ${context.appId} (isInstalled: ${isInstalled})`);

  const libraryAction: ActionItem = isInstalled
    ? {
        id: "remove-to-library",
        label: "Remove to Library",
        onExecute: (ctx) => {
          logInfo("[steam-actions:webview] Remove to Library clicked for", ctx);
          removeFromLibraryOverlay.open(ctx);
        },
      }
    : {
        id: "add-to-library",
        label: "Add to Library",
        onExecute: (ctx) => {
          logInfo("[steam-actions:webview] Add to Library clicked for", ctx);
          addToLibraryOverlay.open(ctx);
        },
      };

  return [
    libraryAction,
    {
      id: "settings",
      label: "Settings",
      onExecute: () => {
        settingsOverlay.open();
      },
    },
  ];
}

/**
 * Preload module injected into Steam browser views (Store, etc.).
 */
export default async function main(): Promise<void> {
  logInfo("%c[steam-actions:webview] main() loaded on: " + window.location.href, "color: #67c1f5; font-weight: bold;");
  logInfo("[steam-actions:webview] Available backend RPC:", typeof backend !== "undefined" ? Object.keys(backend) : "backend is undefined");

  const steamWindow = window as SteamActionsWindow;
  steamWindow[CONTROLLER_KEY]?.stop();

  // Initial sync of installed games from backend config/lua/
  await syncInstalledGames();

  const controller = new ActionsController(
    resolveActions,
    new NativeActionButton(),
    new ActionPopup(),
    (context) => {
      checkGameLua(context.appId);
    },
  );

  steamWindow[CONTROLLER_KEY] = controller;
  controller.start();
}

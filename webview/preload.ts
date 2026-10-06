import { ActionsController } from "./application/actions-controller";
import type { ActionItem, GameContext } from "./domain/action-item";
import { ActionPopup } from "./ui/action-popup";
import { AddToLibraryOverlay } from "./ui/add-to-library-overlay";
import { RemoveFromLibraryOverlay } from "./ui/remove-from-library-overlay";
import { NativeActionButton } from "./ui/native-action-button";
import { SettingsOverlay } from "./ui/settings-overlay";

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
  if (typeof backend === "undefined" || typeof backend.getInstalledAppIds !== "function") return;

  try {
    const appIds = await backend.getInstalledAppIds();
    if (Array.isArray(appIds)) {
      installedAppIds.clear();
      for (const id of appIds) installedAppIds.add(String(id));
    }
  } catch (error) {
    console.error("[steam-actions:webview] Could not sync installed games:", error);
  }
}

async function checkGameLua(appId: string): Promise<boolean> {
  if (typeof backend === "undefined" || typeof backend.hasGameLua !== "function") {
    return installedAppIds.has(appId);
  }

  try {
    const exists = await backend.hasGameLua(appId);
    if (exists) installedAppIds.add(appId);
    else installedAppIds.delete(appId);
    return exists;
  } catch (error) {
    console.error(`[steam-actions:webview] Failed checking hasGameLua for ${appId}:`, error);
  }
  return installedAppIds.has(appId);
}

const settingsOverlay = new SettingsOverlay();
const addToLibraryOverlay = new AddToLibraryOverlay((context) => {
  installedAppIds.add(context.appId);
});
const removeFromLibraryOverlay = new RemoveFromLibraryOverlay((context) => {
  installedAppIds.delete(context.appId);
});

function resolveActions(context: GameContext): ActionItem[] {
  const isInstalled = installedAppIds.has(context.appId);

  const libraryAction: ActionItem = isInstalled
    ? {
        id: "remove-to-library",
        label: "Remove to Library",
        onExecute: (ctx) => removeFromLibraryOverlay.open(ctx),
      }
    : {
        id: "add-to-library",
        label: "Add to Library",
        onExecute: (ctx) => addToLibraryOverlay.open(ctx),
      };

  return [
    libraryAction,
    {
      id: "settings",
      label: "Settings",
      onExecute: () => settingsOverlay.open(),
    },
  ];
}

/**
 * Preload module injected into Steam browser views (Store, etc.).
 */
export default async function main(): Promise<void> {
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

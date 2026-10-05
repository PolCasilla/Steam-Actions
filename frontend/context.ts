import type { GameContext } from "./types";

export function normaliseAppId(value: unknown): string | undefined {
  const text = String(value || "").trim();
  return /^\d{1,10}$/.test(text) && Number(text) > 0 ? text : undefined;
}

export function readAppIdFromObject(value: any): string | undefined {
  if (!value || typeof value !== "object") return undefined;
  for (const key of ["appid", "appId", "unAppID", "app_id"]) {
    const appId = normaliseAppId(value[key]);
    if (appId) return appId;
  }
  for (const key of ["app", "overview", "game", "appOverview", "selectedApp"]) {
    const appId = readAppIdFromObject(value[key]);
    if (appId) return appId;
  }
  return undefined;
}

export function readTitleFromObject(value: any): string | undefined {
  if (!value || typeof value !== "object") return undefined;
  for (const key of ["display_name", "displayName", "strDisplayName", "name", "title"]) {
    const title = value[key];
    if (typeof title === "string" && title.trim().length > 0) return title.trim();
  }
  for (const key of ["app", "overview", "game", "appOverview", "selectedApp"]) {
    const title = readTitleFromObject(value[key]);
    if (title) return title;
  }
  return undefined;
}

export function readReactData(element: Element): { appId?: string; title?: string } {
  let node: Element | null = element;
  while (node) {
    const fiberKey = Object.keys(node).find(
      (k) => k.startsWith("__reactFiber$") || k.startsWith("__reactInternalInstance$")
    );
    const fiber = fiberKey ? (node as any)[fiberKey] : undefined;
    let current = fiber;
    for (let depth = 0; current && depth < 40; depth += 1) {
      const data = [current.memoizedProps, current.pendingProps, current.stateNode?.props].find(
        (candidate) => readAppIdFromObject(candidate)
      );
      if (data) {
        return {
          appId: readAppIdFromObject(data),
          title: readTitleFromObject(data),
        };
      }
      current = current.return;
    }
    node = node.parentElement;
  }
  return {};
}

export function getLibraryGameContext(target: any): GameContext | undefined {
  if (!target || target.nodeType !== 1) return undefined;

  let appId: string | undefined;
  let title: string | undefined;
  let node: Element | null = target;
  while (node && !appId) {
    appId = normaliseAppId(
      node.getAttribute("data-appid") ||
      node.getAttribute("data-app-id") ||
      node.getAttribute("data-app_id")
    );
    title = title || node.getAttribute("data-name") || node.getAttribute("aria-label") || undefined;
    node = node.parentElement;
  }

  const reactData = readReactData(target);
  appId = appId || reactData.appId;
  if (!appId) return undefined;

  const overview = (globalThis as any).appStore?.GetAppOverviewByAppID?.(Number(appId));
  const gameTitle = overview?.display_name || title || reactData.title || `Steam game ${appId}`;
  return {
    appId,
    title: String(gameTitle),
    url: `https://store.steampowered.com/app/${appId}/`,
  };
}

export function isVisible(element: Element): boolean {
  const style = element.ownerDocument?.defaultView?.getComputedStyle(element);
  const bounds = element.getBoundingClientRect();
  return (
    style?.display !== "none" &&
    style?.visibility !== "hidden" &&
    bounds.width > 0 &&
    bounds.height > 0
  );
}

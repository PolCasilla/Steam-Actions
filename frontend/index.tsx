import {
  Millennium,
  definePlugin,
  afterPatch,
  MenuItem,
} from "millennium";
import { getLibraryGameContext, isVisible } from "./context";
import { openActionsModal } from "./modals";

const LIBRARY_MENU_ITEM_ID = "steam-actions-library-context-action";
const LIBRARY_DETAILS_BUTTON_ID = "steam-actions-library-details-action";
const LIBRARY_INTEGRATION_KEY = "__steamActionsLibraryIntegration__";

function createLibraryActionsIcon(popupDocument: Document): SVGElement {
  const namespace = "http://www.w3.org/2000/svg";
  const icon = popupDocument.createElementNS(namespace, "svg");
  icon.setAttribute("class", "SVGIcon_Button SVGIcon_Actions");
  icon.setAttribute("viewBox", "0 0 24 24");
  icon.setAttribute("width", "20");
  icon.setAttribute("height", "20");
  icon.setAttribute("aria-hidden", "true");

  for (const cy of ["5", "12", "19"]) {
    const circle = popupDocument.createElementNS(namespace, "circle");
    circle.setAttribute("cx", "12");
    circle.setAttribute("cy", cy);
    circle.setAttribute("r", "2");
    circle.setAttribute("fill", "currentColor");
    icon.append(circle);
  }

  return icon;
}

function addLibraryDetailsActionsButton(libraryWindow: Window): boolean {
  const libraryDocument = libraryWindow?.document;
  if (!libraryDocument || libraryDocument.getElementById(LIBRARY_DETAILS_BUTTON_ID)) {
    return true;
  }

  const manageButton = [...libraryDocument.querySelectorAll("[role='button'][aria-label='Manage']")].find(
    (button) => isVisible(button) && getLibraryGameContext(button)?.appId
  );
  if (!manageButton) return false;

  const actionsButton = manageButton.cloneNode(false) as HTMLElement;
  actionsButton.id = LIBRARY_DETAILS_BUTTON_ID;
  actionsButton.setAttribute("aria-label", "Actions");
  actionsButton.setAttribute("title", "Game Actions");
  actionsButton.replaceChildren(createLibraryActionsIcon(libraryDocument));

  const openActionMenu = (event: Event): void => {
    event.preventDefault();
    event.stopPropagation();
    const gameContext = getLibraryGameContext(manageButton);
    if (gameContext) openActionsModal(gameContext);
  };

  actionsButton.addEventListener("click", openActionMenu, true);
  actionsButton.addEventListener("keydown", (event: KeyboardEvent) => {
    if (event.key === "Enter" || event.key === " ") openActionMenu(event);
  });

  manageButton.before(actionsButton);
  return true;
}

function installLibraryDetailsActionsButton(libraryWindow: Window): () => void {
  const libraryDocument = libraryWindow?.document;
  if (!libraryDocument?.documentElement) return () => {};

  let queued = false;
  let stopped = false;
  const ensureButton = () => {
    queued = false;
    if (!stopped) addLibraryDetailsActionsButton(libraryWindow);
  };
  const schedule = () => {
    if (!queued && !stopped) {
      queued = true;
      libraryWindow.setTimeout(ensureButton, 0);
    }
  };

  const observer = new libraryWindow.MutationObserver(schedule);
  observer.observe(libraryDocument.documentElement, { childList: true, subtree: true });
  schedule();

  return () => {
    stopped = true;
    observer.disconnect();
  };
}

function installLibraryDetailsWindows(): () => void {
  const teardowns: (() => void)[] = [];
  const desktopWindows = new WeakSet<Window>();
  let active = true;

  const attachWindow = (context: any) => {
    if (!active || !context?.m_popup) return;
    const name = String(context.m_strName || "");
    if (name.startsWith("SP Desktop_") && !desktopWindows.has(context.m_popup)) {
      desktopWindows.add(context.m_popup);
      teardowns.push(installLibraryDetailsActionsButton(context.m_popup));
    }
  };

  Millennium.AddWindowCreateHook?.(attachWindow);

  return () => {
    active = false;
    teardowns.splice(0).forEach((t) => t());
  };
}

function injectNativeLibraryActionsItem(menu: any, renderedMenu: any): any {
  const children = renderedMenu?.props?.children;
  if (!Array.isArray(children)) return renderedMenu;

  const favoriteIndex = children.findIndex((child: any) => {
    const label = child?.props?.children;
    return label === "Add to Favorites" || label === "Remove from Favorites";
  });

  if (favoriteIndex < 0 || children.some((child: any) => child?.props?.[LIBRARY_MENU_ITEM_ID])) {
    return renderedMenu;
  }

  const actionsItem = (globalThis as any).SP_REACT.createElement(
    MenuItem,
    {
      key: "steam-actions-library-context",
      [LIBRARY_MENU_ITEM_ID]: true,
      onSelected: () => {
        const overview = menu.props?.overview || menu.GetTargetApps?.()?.[0];
        const appId = overview?.appid ? String(overview.appid) : undefined;
        if (appId) {
          openActionsModal({
            appId,
            title: String(overview.display_name || `Steam game ${appId}`),
            url: `https://store.steampowered.com/app/${appId}/`,
          });
        }
      },
    },
    "Actions"
  );

  const nextChildren = [...children];
  nextChildren.splice(favoriteIndex + 1, 0, actionsItem);
  return {
    ...renderedMenu,
    props: { ...renderedMenu.props, children: nextChildren },
  };
}

function installLibraryContextMenuPatch(): () => void {
  const jsxFactory = (globalThis as any).SP_JSX_FACTORY;
  if (!jsxFactory?.jsx) return () => {};

  let renderPatch: any;
  const jsxPatch = afterPatch(jsxFactory, "jsx", (args: any, result: any) => {
    const menuClass = args[0];
    const prototype = menuClass?.prototype;
    if (
      renderPatch ||
      !prototype ||
      typeof prototype.GetTargetApps !== "function" ||
      typeof prototype.AddToFavorites !== "function" ||
      typeof prototype.render !== "function"
    ) {
      return result;
    }

    renderPatch = afterPatch(
      prototype,
      "render",
      function (this: any, _renderArgs: any, renderedMenu: any) {
        return injectNativeLibraryActionsItem(this, renderedMenu);
      }
    );
    jsxPatch.unpatch();
    return result;
  });

  return () => {
    if (!jsxPatch.hasUnpatched) jsxPatch.unpatch();
    if (renderPatch && !renderPatch.hasUnpatched) renderPatch.unpatch();
  };
}

export default definePlugin(() => {
  (globalThis as any)[LIBRARY_INTEGRATION_KEY]?.stop?.();

  const stopWindows = installLibraryDetailsWindows();
  const stopMenuPatch = installLibraryContextMenuPatch();

  const stop = () => {
    stopWindows();
    stopMenuPatch();
  };

  (globalThis as any)[LIBRARY_INTEGRATION_KEY] = { stop };

  return {
    icon: null,
    onDismount: stop,
  };
});

import type { ActionItem, GameContext } from "../domain/action-item";
import { getSteamStoreGameContext } from "../routing/store-page";
import { ActionPopup } from "../ui/action-popup";
import { NativeActionButton } from "../ui/native-action-button";

export type ActionsProvider = ActionItem[] | ((context: GameContext) => ActionItem[] | Promise<ActionItem[]>);

/**
 * Keeps the injected Actions button and popup in sync with Steam's client-side store page updates.
 */
export class ActionsController {
  private observer: MutationObserver | undefined;
  private injectionQueued = false;
  private restoreHistory: (() => void) | undefined;
  private currentAppId: string | null = null;

  public constructor(
    private readonly actions: ActionsProvider,
    private readonly button: NativeActionButton,
    private readonly popup: ActionPopup,
    private readonly onNavigate?: (context: GameContext) => void,
  ) {}

  public start(): void {
    this.observePageChanges();
    this.scheduleReconcile();
  }

  public stop(): void {
    this.observer?.disconnect();
    this.observer = undefined;
    this.restoreHistory?.();
    this.restoreHistory = undefined;
    this.button.remove();
    this.popup.close();
  }

  private observePageChanges(): void {
    const schedule = (): void => this.scheduleReconcile();
    window.addEventListener("popstate", schedule);
    window.addEventListener("hashchange", schedule);
    this.restoreHistory = this.patchHistory(schedule, () => {
      window.removeEventListener("popstate", schedule);
      window.removeEventListener("hashchange", schedule);
    });

    this.observer = new MutationObserver(schedule);
    this.observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
  }

  private patchHistory(schedule: () => void, restoreListeners: () => void): () => void {
    const originalPushState = window.history.pushState;
    const originalReplaceState = window.history.replaceState;

    const wrappedPushState = function pushState(
      this: History,
      ...args: Parameters<History["pushState"]>
    ): void {
      originalPushState.apply(this, args);
      schedule();
    };
    const wrappedReplaceState = function replaceState(
      this: History,
      ...args: Parameters<History["replaceState"]>
    ): void {
      originalReplaceState.apply(this, args);
      schedule();
    };

    window.history.pushState = wrappedPushState;
    window.history.replaceState = wrappedReplaceState;

    return () => {
      if (window.history.pushState === wrappedPushState) {
        window.history.pushState = originalPushState;
      }
      if (window.history.replaceState === wrappedReplaceState) {
        window.history.replaceState = originalReplaceState;
      }
      restoreListeners();
    };
  }

  private scheduleReconcile(): void {
    if (this.injectionQueued) {
      return;
    }

    this.injectionQueued = true;
    window.requestAnimationFrame(() => {
      this.injectionQueued = false;
      this.reconcile();
    });
  }

  private reconcile(): void {
    const context = getSteamStoreGameContext(window.location);
    if (!context) {
      this.currentAppId = null;
      this.button.remove();
      this.popup.close();
      return;
    }

    if (this.currentAppId !== context.appId) {
      this.currentAppId = context.appId;
      this.onNavigate?.(context);
    }

    this.button.ensure({
      label: "Actions",
      onActivate: async (buttonElement) => {
        const currentContext = getSteamStoreGameContext(window.location);
        if (currentContext) {
          const resolvedActions =
            typeof this.actions === "function" ? await this.actions(currentContext) : this.actions;
          this.popup.open(currentContext, resolvedActions, buttonElement);
        }
      },
    });
  }
}

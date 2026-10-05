const BUTTON_ID = "steam-actions-button";
const ACTION_HOST_SELECTOR = ".queue_actions_ctn";
const NATIVE_CONTROL_SELECTOR =
  ".queue_btn_ignore, .queue_btn_follow, #add_to_wishlist_area, .queue_control_button:not(.right)";
const NATIVE_BUTTON_SELECTOR = ".queue_btn_inactive, .btnv6_blue_hoverfade, .btnv6_lightblue_blue";

export interface NativeActionButtonOptions {
  readonly label: string;
  readonly onActivate: (buttonElement: HTMLElement) => void;
}

/**
 * Creates and injects an Actions button matching native Steam Store action styling.
 */
export class NativeActionButton {
  private isBpm: boolean | null = null;

  public constructor() {
    this.initUIMode();
  }

  private async initUIMode(): Promise<void> {
    try {
      const ui = (window as any).SteamClient?.UI;
      if (ui?.GetUIMode) {
        const mode = await ui.GetUIMode();
        this.isBpm = mode === 4;
        ui.RegisterForUIModeChanged?.((nextMode: number) => {
          this.isBpm = nextMode === 4;
        });
      }
    } catch {
      // ignore
    }
  }

  public ensure(options: NativeActionButtonOptions): void {
    if (document.getElementById(BUTTON_ID)) {
      return;
    }

    const inBpm =
      this.isBpm === true ||
      (this.isBpm === null && !document.querySelector(ACTION_HOST_SELECTOR) && this.findBpmControls() !== null);

    if (inBpm) {
      if (this.ensureBpm(options)) {
        return;
      }
    }

    this.ensureDesktop(options);
  }

  public remove(): void {
    document.getElementById(BUTTON_ID)?.remove();
  }

  private ensureBpm(options: NativeActionButtonOptions): boolean {
    const controls = this.findBpmControls();
    if (!controls) {
      return false;
    }

    const { followWrapper, ignoreWrapper } = controls;
    const sampleWrapper = ignoreWrapper || followWrapper;
    const sampleButton = sampleWrapper.querySelector<HTMLElement>("button, [role='button']") || sampleWrapper;

    const actionsWrapper = sampleWrapper.cloneNode(false) as HTMLElement;
    actionsWrapper.id = BUTTON_ID;
    actionsWrapper.classList.add("steam-actions-bpm-control");

    const button = sampleButton.cloneNode(false) as HTMLElement;
    button.removeAttribute("id");
    button.classList.add("Focusable", "steam-actions-bpm-button");

    const textSpan =
      (sampleButton.querySelector("span")?.cloneNode(false) as HTMLElement | null) ||
      document.createElement("span");
    textSpan.textContent = options.label;
    button.replaceChildren(textSpan);

    const activate = (event: Event): void => {
      event.preventDefault();
      event.stopPropagation();
      options.onActivate(button);
    };

    button.addEventListener("click", activate);
    button.addEventListener("keydown", (event: KeyboardEvent) => {
      if (event.key === "Enter" || event.key === " ") {
        activate(event);
      }
    });

    actionsWrapper.appendChild(button);

    if (followWrapper.compareDocumentPosition(ignoreWrapper) & Node.DOCUMENT_POSITION_FOLLOWING) {
      ignoreWrapper.before(actionsWrapper);
    } else {
      followWrapper.before(actionsWrapper);
    }

    return true;
  }

  private findBpmControls(): { followWrapper: HTMLElement; ignoreWrapper: HTMLElement } | null {
    const buttons = Array.from(document.querySelectorAll<HTMLElement>("button, [role='button']"));
    const followBtn = buttons.find((b) => /\bfollow(ed)?\b/i.test(b.textContent || ""));
    const ignoreBtn = buttons.find((b) => /\bignore(d)?\b/i.test(b.textContent || ""));

    if (!followBtn || !ignoreBtn) {
      return null;
    }

    const followWrapper =
      followBtn.closest<HTMLElement>("div[style*='flex-grow']") || (followBtn.parentElement as HTMLElement | null);
    const ignoreWrapper =
      ignoreBtn.closest<HTMLElement>("div[style*='flex-grow']") || (ignoreBtn.parentElement as HTMLElement | null);

    if (!followWrapper || !ignoreWrapper || followWrapper.parentElement !== ignoreWrapper.parentElement) {
      return null;
    }

    return { followWrapper, ignoreWrapper };
  }

  private ensureDesktop(options: NativeActionButtonOptions): void {
    const host = document.querySelector(ACTION_HOST_SELECTOR);
    if (!host) {
      return;
    }

    const nativeControl = host.querySelector(NATIVE_CONTROL_SELECTOR);
    if (!nativeControl) {
      return;
    }

    const control = this.createControl(nativeControl, options);
    nativeControl.insertAdjacentElement("afterend", control);
  }

  private createControl(nativeControl: Element, options: NativeActionButtonOptions): HTMLElement {
    const wrapper = document.createElement("div");
    if (nativeControl.classList.contains("queue_control_button")) {
      wrapper.className = nativeControl.className;
    }
    wrapper.id = BUTTON_ID;
    wrapper.classList.remove("queue_btn_follow", "queue_btn_ignore", "queue_btn_inactive", "queue_btn_active", "right");
    wrapper.classList.add("queue_control_button", "steam-actions-control");

    const nativeButton = nativeControl.matches(NATIVE_BUTTON_SELECTOR)
      ? nativeControl
      : nativeControl.querySelector(NATIVE_BUTTON_SELECTOR);

    const button = nativeButton ? (nativeButton.cloneNode(false) as HTMLElement) : document.createElement("div");
    button.classList.remove("queue_btn_inactive", "queue_btn_active");
    button.removeAttribute("id");
    button.classList.add("btnv6_blue_hoverfade", "btn_medium");

    const labelSpan = document.createElement("span");
    labelSpan.textContent = options.label;
    button.replaceChildren(labelSpan);

    const activate = (event: Event): void => {
      event.preventDefault();
      event.stopPropagation();
      options.onActivate(button);
    };

    button.addEventListener("click", activate);
    button.addEventListener("keydown", (event: KeyboardEvent) => {
      if (event.key === "Enter" || event.key === " ") {
        activate(event);
      }
    });

    wrapper.appendChild(button);
    return wrapper;
  }
}

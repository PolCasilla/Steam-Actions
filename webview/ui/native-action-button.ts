import { isBigPictureMode } from "../routing/store-page";

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
 * In Big Picture Mode, docks fixed at the rightmost edge of the bottom action bar.
 * In Desktop mode, injects into the native action queue container (.queue_actions_ctn).
 */
export class NativeActionButton {
  private cleanupBpm: (() => void) | null = null;

  public ensure(options: NativeActionButtonOptions): void {
    const existing = document.getElementById(BUTTON_ID);
    if (existing) {
      if (existing.isConnected) {
        return;
      }
      existing.remove();
    }

    if (isBigPictureMode()) {
      if (this.ensureBpmBottom(options)) {
        return;
      }
    }

    if (this.ensureDesktop(options)) {
      return;
    }

    // Fallback: If desktop container wasn't found, dock at the bottom right
    this.ensureBpmBottom(options);
  }

  public remove(): void {
    this.cleanupBpm?.();
    this.cleanupBpm = null;
    document.getElementById(BUTTON_ID)?.remove();
  }

  private ensureBpmBottom(options: NativeActionButtonOptions): boolean {
    if (typeof document === "undefined") {
      return false;
    }

    const target = document.body || document.documentElement;
    if (!target) {
      return false;
    }

    this.cleanupBpm?.();
    this.cleanupBpm = null;

    const button = document.createElement("button");
    button.id = BUTTON_ID;
    button.type = "button";
    button.className = "Focusable steam-actions-bpm-button steam-actions-bpm-bottom-button";
    button.setAttribute("tabindex", "0");
    button.setAttribute("data-panel", '{"focusable":true,"clickOnActivate":true}');
    button.setAttribute("aria-label", options.label);

    const labelSpan = document.createElement("span");
    labelSpan.textContent = options.label;
    button.appendChild(labelSpan);

    // Styling: native Big Picture Mode bottom bar pill docked at the rightmost edge
    button.style.cssText = `
      position: fixed;
      bottom: 10px;
      right: 24px;
      left: auto;
      z-index: 2147483640;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      height: 32px;
      padding: 0 16px;
      border-radius: 16px;
      background: rgba(35, 42, 53, 0.95);
      border: 1px solid rgba(255, 255, 255, 0.2);
      color: #ffffff;
      font-family: "Motiva Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      user-select: none;
      pointer-events: auto;
      box-sizing: border-box;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
      transition: background 0.12s ease, border-color 0.12s ease, box-shadow 0.12s ease;
    `;

    // Focus and hover styling matching Steam GamepadUI
    const onFocus = (): void => {
      button.classList.add("gpfocus");
      button.style.background = "rgba(60, 72, 88, 0.98)";
      button.style.borderColor = "#ffffff";
      button.style.outline = "2px solid #ffffff";
      button.style.boxShadow = "0 0 14px rgba(103, 193, 245, 0.9)";
    };
    const onBlur = (): void => {
      button.classList.remove("gpfocus");
      button.style.background = "rgba(35, 42, 53, 0.95)";
      button.style.borderColor = "rgba(255, 255, 255, 0.2)";
      button.style.outline = "none";
      button.style.boxShadow = "0 2px 8px rgba(0, 0, 0, 0.5)";
    };
    button.addEventListener("focus", onFocus);
    button.addEventListener("blur", onBlur);
    button.addEventListener("mouseenter", onFocus);
    button.addEventListener("mouseleave", () => {
      if (typeof document !== "undefined" && document.activeElement !== button) {
        onBlur();
      }
    });

    const activate = (event: Event): void => {
      event.preventDefault();
      event.stopPropagation();
      options.onActivate(button);
    };

    button.addEventListener("click", activate);
    button.addEventListener("pointerup", activate);
    button.addEventListener("vgp_buttondown", (e: any) => {
      if (e.detail?.button === 0 || e.button === 0) {
        activate(e);
      }
    });
    button.addEventListener("GamepadNavActivate" as any, activate);

    // Directional navigation (Actions is right-most)
    const onButtonKeyDown = (e: KeyboardEvent): void => {
      if (e.key === "Enter" || e.key === " " || (e as any).keyCode === 13) {
        e.preventDefault();
        e.stopPropagation();
        activate(e);
      } else if (e.key === "ArrowLeft" || e.key === "Left") {
        const bottomButtons = Array.from(
          document.querySelectorAll<HTMLElement>("button, [role='button'], .Focusable")
        ).filter((el) => {
          if (el === button || !el.isConnected) return false;
          if (typeof el.getBoundingClientRect === "function") {
            const r = el.getBoundingClientRect();
            return r.bottom >= (typeof window !== "undefined" ? window.innerHeight - 80 : 700);
          }
          return false;
        });
        const leftTarget = bottomButtons[bottomButtons.length - 1];
        if (leftTarget && typeof leftTarget.focus === "function") {
          e.preventDefault();
          e.stopPropagation();
          leftTarget.focus();
        }
      } else if (e.key === "ArrowUp" || e.key === "Up") {
        const storeTarget = document.querySelector<HTMLElement>(
          ".Focusable:not(.steam-actions-bpm-bottom-button), #add_to_wishlist_area, .btn_addtocart, .queue_control_button"
        );
        if (storeTarget && typeof storeTarget.focus === "function") {
          e.preventDefault();
          e.stopPropagation();
          storeTarget.focus();
        }
      }
    };
    button.addEventListener("keydown", onButtonKeyDown, true);

    // Bridge navigation from adjacent bottom bar buttons to Actions
    const bottomButtons = Array.from(
      document.querySelectorAll<HTMLElement>("button, [role='button'], .Focusable")
    ).filter((el) => {
      if (el === button || !el.isConnected) return false;
      if (typeof el.getBoundingClientRect === "function") {
        const r = el.getBoundingClientRect();
        return r.bottom >= (typeof window !== "undefined" ? window.innerHeight - 80 : 700);
      }
      return false;
    });
    const lastBottomBtn = bottomButtons[bottomButtons.length - 1];
    const listenersToClean: Array<{ target: HTMLElement; event: string; fn: EventListener }> = [];

    if (lastBottomBtn && typeof lastBottomBtn.addEventListener === "function") {
      const onLeftBtnKeyDown = (e: KeyboardEvent) => {
        if (e.key === "ArrowRight" || e.key === "Right") {
          e.preventDefault();
          e.stopPropagation();
          button.focus();
        }
      };
      lastBottomBtn.addEventListener("keydown", onLeftBtnKeyDown as EventListener, true);
      listenersToClean.push({ target: lastBottomBtn, event: "keydown", fn: onLeftBtnKeyDown as EventListener });
    }

    this.cleanupBpm = () => {
      for (const item of listenersToClean) {
        item.target.removeEventListener(item.event, item.fn, true);
      }
    };

    target.appendChild(button);
    return true;
  }

  private ensureDesktop(options: NativeActionButtonOptions): boolean {
    const host = document.querySelector(ACTION_HOST_SELECTOR);
    if (!host) {
      return false;
    }

    const followControl = host.querySelector(".queue_btn_follow");
    const nativeControl = followControl || host.querySelector(NATIVE_CONTROL_SELECTOR);
    if (!nativeControl) {
      return false;
    }

    const control = this.createControl(nativeControl, options);
    nativeControl.insertAdjacentElement("afterend", control);
    return true;
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
    button.setAttribute("data-panel", '{"focusable":true,"clickOnActivate":true}');

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

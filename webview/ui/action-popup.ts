import type { ActionItem, GameContext } from "../domain/action-item";
import { isBigPictureMode } from "../routing/store-page";
import { makeFocusable } from "./focusable";

const POPUP_ID = "steam-actions-popup";

/**
 * Creates and manages a Steam-themed popup overlay anchored to the trigger button.
 */
export class ActionPopup {
  private activePopup: HTMLElement | null = null;
  private outsideClickListener: ((event: MouseEvent) => void) | null = null;
  private keydownListener: ((event: KeyboardEvent) => void) | null = null;

  public open(context: GameContext, actions: ActionItem[], anchor: HTMLElement): void {
    this.close();

    const popup = document.createElement("div");
    popup.id = POPUP_ID;
    popup.setAttribute("role", "menu");
    popup.setAttribute("data-panel", '{"flow-children":"column"}');
    popup.style.cssText = `
      position: absolute;
      z-index: 2147483646;
      min-width: 180px;
      padding: 6px 0;
      background: #1b2838;
      border: 1px solid #4c6b88;
      border-radius: 4px;
      box-shadow: 0 6px 20px rgba(0, 0, 0, 0.75);
      font-family: "Motiva Sans", Arial, Helvetica, sans-serif;
      font-size: 13px;
      color: #d6d7d8;
      display: flex;
      flex-direction: column;
    `;

    // Render each action item
    for (const action of actions) {
      popup.appendChild(
        this.createMenuItem(action.label, () => {
          action.onExecute(context);
          this.close();
        }),
      );
    }

    // Add separator before Close button
    const separator = document.createElement("div");
    separator.style.cssText = "height: 1px; background: #2a475e; margin: 4px 0;";
    popup.appendChild(separator);

    // Add Close item
    popup.appendChild(
      this.createMenuItem("Close", () => {
        this.close();
        anchor?.focus?.();
      }),
    );

    document.body.appendChild(popup);
    this.activePopup = popup;

    this.positionPopup(popup, anchor);

    const menuItems = Array.from(popup.querySelectorAll<HTMLElement>(".steam-actions-menu-item"));

    // Close on outside pointer click
    this.outsideClickListener = (event: MouseEvent): void => {
      const target = event.target as Node | null;
      if (target && !popup.contains(target) && !anchor.contains(target)) {
        this.close();
      }
    };
    window.addEventListener("pointerdown", this.outsideClickListener, true);

    // Keydown listener
    this.keydownListener = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        this.close();
        anchor?.focus?.();
        return;
      }

      const activeEl = (typeof document !== "undefined" ? document.activeElement : null) as HTMLElement | null;
      const currentIndex = activeEl ? menuItems.indexOf(activeEl) : -1;

      if (event.key === "ArrowDown" || event.key === "Down") {
        event.preventDefault();
        event.stopPropagation();
        const nextIndex = currentIndex < menuItems.length - 1 ? currentIndex + 1 : 0;
        menuItems[nextIndex]?.focus();
      } else if (event.key === "ArrowUp" || event.key === "Up") {
        event.preventDefault();
        event.stopPropagation();
        const prevIndex = currentIndex > 0 ? currentIndex - 1 : menuItems.length - 1;
        menuItems[prevIndex]?.focus();
      } else if (event.key === "Home") {
        event.preventDefault();
        event.stopPropagation();
        menuItems[0]?.focus();
      } else if (event.key === "End") {
        event.preventDefault();
        event.stopPropagation();
        menuItems[menuItems.length - 1]?.focus();
      }
    };
    window.addEventListener("keydown", this.keydownListener, true);

    // Focus the first menu item so controller / keyboard navigation starts smoothly
    const focusFirst = () => {
      menuItems[0]?.focus();
      const win = typeof window !== "undefined" ? (window as any) : null;
      if (win && typeof win.GPNavFocusChild === "function" && menuItems[0]) {
        try { win.GPNavFocusChild(menuItems[0]); } catch {}
      }
    };
    focusFirst();
    if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
      window.requestAnimationFrame(focusFirst);
    }
  }

  public close(): void {
    if (this.outsideClickListener) {
      window.removeEventListener("pointerdown", this.outsideClickListener, true);
      this.outsideClickListener = null;
    }
    if (this.keydownListener) {
      window.removeEventListener("keydown", this.keydownListener, true);
      this.keydownListener = null;
    }
    if (this.activePopup) {
      this.activePopup.remove();
      this.activePopup = null;
    }
  }

  private createMenuItem(label: string, onClick: () => void): HTMLElement {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "steam-actions-menu-item Focusable";
    item.setAttribute("role", "menuitem");
    item.setAttribute("tabindex", "0");
    item.textContent = label;
    item.style.cssText = `
      display: block;
      width: 100%;
      text-align: left;
      padding: 10px 16px;
      background: transparent;
      border: 2px solid transparent;
      outline: none;
      font-family: "Motiva Sans", Arial, Helvetica, sans-serif;
      font-size: 13px;
      color: #d6d7d8;
      cursor: pointer;
      user-select: none;
      box-sizing: border-box;
      transition: background 0.12s ease, color 0.12s ease, border-color 0.12s ease, box-shadow 0.12s ease;
    `;

    makeFocusable(item, {
      baseBg: "transparent",
      hoverBg: "#2a475e",
      focusBorderColor: "#67c1f5",
      onActivate: onClick,
    });

    return item;
  }

  private positionPopup(popup: HTMLElement, anchor: HTMLElement): void {
    const rect = anchor.getBoundingClientRect();
    const winHeight = typeof window !== "undefined" ? window.innerHeight : 800;
    const winWidth = typeof window !== "undefined" ? window.innerWidth : 1280;

    const isBottomDocked =
      anchor.classList.contains("steam-actions-bpm-bottom-button") ||
      (rect.bottom > 0 && rect.bottom > winHeight - 80);

    if (isBottomDocked) {
      popup.style.position = "fixed";
      const popupHeight = popup.offsetHeight || 170;
      popup.style.top = `${Math.max(16, rect.top - popupHeight - 8)}px`;
      if (rect.left > winWidth / 2 || rect.right > winWidth - 250) {
        popup.style.right = `${Math.max(16, winWidth - rect.right)}px`;
        popup.style.left = "auto";
      } else {
        popup.style.left = `${Math.max(16, Math.min(rect.left, winWidth - 240))}px`;
        popup.style.right = "auto";
      }
      popup.style.bottom = "auto";
      popup.style.zIndex = "2147483647";
      return;
    }

    const isFloating =
      anchor.classList.contains("steam-actions-floating-button") ||
      (typeof window.getComputedStyle === "function" && window.getComputedStyle(anchor).position === "fixed");

    if (isFloating) {
      popup.style.position = "fixed";
      const popupHeight = popup.offsetHeight || 160;
      if (rect.bottom + popupHeight + 16 > winHeight && rect.top > popupHeight) {
        popup.style.top = `${rect.top - popupHeight - 8}px`;
      } else {
        popup.style.top = `${rect.bottom + 8}px`;
      }
      popup.style.right = `${Math.max(16, winWidth - rect.right)}px`;
      popup.style.left = "auto";
      return;
    }

    const docEl = typeof document !== "undefined" ? document.documentElement : null;
    const scrollX = (typeof window !== "undefined" ? window.scrollX : 0) || (docEl ? docEl.scrollLeft : 0) || 0;
    const scrollY = (typeof window !== "undefined" ? window.scrollY : 0) || (docEl ? docEl.scrollTop : 0) || 0;

    popup.style.top = `${rect.bottom + scrollY + 4}px`;
    popup.style.left = `${rect.left + scrollX}px`;
  }
}

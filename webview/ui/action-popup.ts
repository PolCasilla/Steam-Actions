import type { ActionItem, GameContext } from "../domain/action-item";

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
    popup.style.cssText = `
      position: absolute;
      z-index: 2147483646;
      min-width: 180px;
      padding: 6px 0;
      background: #1b2838;
      border: 1px solid #4c6b88;
      border-radius: 3px;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.7);
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
      }),
    );

    document.body.appendChild(popup);
    this.activePopup = popup;

    this.positionPopup(popup, anchor);

    // Close on outside click
    this.outsideClickListener = (event: MouseEvent): void => {
      const target = event.target as Node | null;
      if (target && !popup.contains(target) && !anchor.contains(target)) {
        this.close();
      }
    };
    window.addEventListener("pointerdown", this.outsideClickListener, true);

    // Close on Escape key
    this.keydownListener = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        this.close();
      }
    };
    window.addEventListener("keydown", this.keydownListener, true);
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
    const item = document.createElement("div");
    item.setAttribute("role", "menuitem");
    item.textContent = label;
    item.style.cssText = `
      padding: 8px 16px;
      cursor: pointer;
      user-select: none;
      transition: background 0.1s ease, color 0.1s ease;
      color: #d6d7d8;
    `;

    item.addEventListener("mouseenter", () => {
      item.style.background = "#2a475e";
      item.style.color = "#ffffff";
    });
    item.addEventListener("mouseleave", () => {
      item.style.background = "transparent";
      item.style.color = "#d6d7d8";
    });
    item.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      onClick();
    });

    return item;
  }

  private positionPopup(popup: HTMLElement, anchor: HTMLElement): void {
    const rect = anchor.getBoundingClientRect();
    const scrollX = window.scrollX || document.documentElement.scrollLeft;
    const scrollY = window.scrollY || document.documentElement.scrollTop;

    popup.style.top = `${rect.bottom + scrollY + 4}px`;
    popup.style.left = `${rect.left + scrollX}px`;
  }
}

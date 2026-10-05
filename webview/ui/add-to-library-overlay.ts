import type { GameContext } from "../domain/action-item";

const OVERLAY_ID = "steam-actions-library-overlay";
const LOG_PREFIX = "[steam-actions:add-to-library]";

declare const backend: {
  addToLibrary?: (appId: string, title?: string) => Promise<string>;
};

/**
 * Calls the backend RPC addToLibrary function.
 * All API calling is handled within the backend RPC.
 */
export async function addToLibraryApi(
  context: GameContext,
): Promise<{ success: boolean; message?: string }> {
  console.log(LOG_PREFIX, "Calling backend RPC addToLibrary for appId:", context.appId, context.title);

  if (typeof backend !== "undefined" && typeof backend.addToLibrary === "function") {
    try {
      const raw = await backend.addToLibrary(context.appId, context.title);
      console.log(LOG_PREFIX, "Backend RPC raw response:", raw);
      const data = typeof raw === "string" ? JSON.parse(raw) : raw;

      if (data && data.success) {
        return { success: true, message: data.message };
      }
      return {
        success: false,
        message: data?.message || `Failed to add game to library (status ${data?.status || "unknown"}).`,
      };
    } catch (err: unknown) {
      console.error(LOG_PREFIX, "Backend RPC addToLibrary error:", err);
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, message };
    }
  }

  console.warn(LOG_PREFIX, "backend.addToLibrary RPC is not available in current window!");
  return {
    success: false,
    message: "Backend RPC service is unavailable. Please ensure plugin backend is running.",
  };
}

export type AddToLibrarySuccessCallback = (context: GameContext) => void;

/**
 * Centered modal overlay that handles the Add-to-Library workflow:
 * 1. Loading overlay (while API call is in flight)
 * 2. Success overlay (when game is added to the library)
 * 3. Error overlay (if the API fails or returns an error, with Retry option)
 */
export class AddToLibraryOverlay {
  private backdrop: HTMLElement | null = null;
  private keyHandler: ((e: KeyboardEvent) => void) | null = null;

  public constructor(private readonly onSuccess?: AddToLibrarySuccessCallback) {}

  public async open(context: GameContext): Promise<void> {
    console.log(LOG_PREFIX, "Opening Add to Library overlay for:", context);
    this.close();

    const backdrop = document.createElement("div");
    backdrop.id = OVERLAY_ID;
    backdrop.style.cssText = `
      position: fixed; inset: 0; z-index: 2147483647;
      display: flex; align-items: center; justify-content: center;
      background: rgba(0, 0, 0, 0.65);
      font-family: "Motiva Sans", Arial, Helvetica, sans-serif;
    `;

    const panel = document.createElement("div");
    panel.style.cssText = `
      background: #1b2838; border: 1px solid #4c6b88; border-radius: 4px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.85);
      padding: 28px 24px; min-width: 360px; max-width: 440px; color: #d6d7d8;
      box-sizing: border-box; text-align: center;
    `;

    backdrop.appendChild(panel);
    document.body.appendChild(backdrop);
    this.backdrop = backdrop;

    this.keyHandler = (e: KeyboardEvent) => {
      if (e.key === "Escape") this.close();
    };
    window.addEventListener("keydown", this.keyHandler, true);

    backdrop.addEventListener("pointerdown", (e) => {
      if (e.target === backdrop) this.close();
    });

    await this.executeAddFlow(panel, context);
  }

  public close(): void {
    if (this.backdrop) {
      console.log(LOG_PREFIX, "Closing overlay");
    }
    if (this.keyHandler) {
      window.removeEventListener("keydown", this.keyHandler, true);
      this.keyHandler = null;
    }
    this.backdrop?.remove();
    this.backdrop = null;
  }

  private async executeAddFlow(panel: HTMLElement, context: GameContext): Promise<void> {
    this.renderLoading(panel, context);

    try {
      const result = await addToLibraryApi(context);
      if (result.success) {
        this.renderSuccess(panel, context);
        this.onSuccess?.(context);
      } else {
        this.renderError(
          panel,
          context,
          result.message || "An unexpected error occurred while adding to library.",
        );
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(LOG_PREFIX, "Error in Add to Library:", err);
      this.renderError(panel, context, message);
    }
  }

  private renderLoading(panel: HTMLElement, context: GameContext): void {
    panel.replaceChildren();

    // Spinner SVG
    const spinnerWrap = document.createElement("div");
    spinnerWrap.style.cssText = "margin: 8px auto 20px auto; width: 44px; height: 44px;";
    spinnerWrap.innerHTML = `
      <svg width="44" height="44" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg" stroke="#67c1f5">
        <g fill="none" fill-rule="evenodd">
          <g transform="translate(2 2)" stroke-width="3">
            <circle stroke-opacity=".2" cx="18" cy="18" r="18" stroke="#67c1f5"/>
            <path d="M36 18c0-9.94-8.06-18-18-18">
              <animateTransform
                attributeName="transform"
                type="rotate"
                from="0 18 18"
                to="360 18 18"
                dur="0.8s"
                repeatCount="indefinite"/>
            </path>
          </g>
        </g>
      </svg>
    `;
    panel.appendChild(spinnerWrap);

    // Title
    const title = document.createElement("div");
    title.textContent = "Adding to Library...";
    title.style.cssText = "font-size: 18px; font-weight: bold; color: #67c1f5; margin-bottom: 8px;";
    panel.appendChild(title);

    // Game name & App ID
    const gameName = document.createElement("div");
    gameName.textContent = context.title;
    gameName.style.cssText = "font-size: 14px; color: #ffffff; margin-bottom: 4px; word-break: break-word;";
    panel.appendChild(gameName);

    const appIdInfo = document.createElement("div");
    appIdInfo.textContent = `App ID: ${context.appId}`;
    appIdInfo.style.cssText = "font-size: 12px; color: #8f98a0; margin-bottom: 18px;";
    panel.appendChild(appIdInfo);

    // Subtext
    const subtext = document.createElement("div");
    subtext.textContent = "Connecting to API, please wait...";
    subtext.style.cssText = "font-size: 13px; color: #8f98a0;";
    panel.appendChild(subtext);
  }

  private renderSuccess(panel: HTMLElement, context: GameContext): void {
    panel.replaceChildren();

    // Success Checkmark SVG
    const iconWrap = document.createElement("div");
    iconWrap.style.cssText = "margin: 4px auto 16px auto; width: 52px; height: 52px;";
    iconWrap.innerHTML = `
      <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="#4caf50" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10" stroke="#4caf50" fill="rgba(76, 175, 80, 0.15)"></circle>
        <polyline points="7 13 10 16 17 9"></polyline>
      </svg>
    `;
    panel.appendChild(iconWrap);

    // Title
    const title = document.createElement("div");
    title.textContent = "Added to Library";
    title.style.cssText = "font-size: 18px; font-weight: bold; color: #4caf50; margin-bottom: 12px;";
    panel.appendChild(title);

    // Description Card
    const descCard = document.createElement("div");
    descCard.style.cssText = `
      background: rgba(76, 175, 80, 0.08); border: 1px solid rgba(76, 175, 80, 0.3);
      border-radius: 3px; padding: 14px; margin-bottom: 20px; text-align: left;
    `;

    const gameEl = document.createElement("div");
    gameEl.textContent = context.title;
    gameEl.style.cssText = "font-size: 14px; font-weight: bold; color: #ffffff; margin-bottom: 4px; word-break: break-word;";
    descCard.appendChild(gameEl);

    const msgEl = document.createElement("div");
    msgEl.textContent = "This game is now added to your Steam library.";
    msgEl.style.cssText = "font-size: 13px; color: #c6d4df; margin-bottom: 6px;";
    descCard.appendChild(msgEl);

    const appIdEl = document.createElement("div");
    appIdEl.textContent = `App ID: ${context.appId}`;
    appIdEl.style.cssText = "font-size: 12px; color: #8f98a0;";
    descCard.appendChild(appIdEl);

    panel.appendChild(descCard);

    // Action button
    const okBtn = document.createElement("button");
    okBtn.textContent = "OK";
    okBtn.style.cssText = `
      padding: 9px 28px; border: none; border-radius: 3px;
      font-size: 13px; font-family: inherit; font-weight: bold; cursor: pointer;
      background: #67c1f5; color: #1b2838; transition: background 0.15s ease;
    `;
    okBtn.addEventListener("mouseenter", () => { okBtn.style.background = "#8ed4f8"; });
    okBtn.addEventListener("mouseleave", () => { okBtn.style.background = "#67c1f5"; });
    okBtn.addEventListener("click", () => this.close());
    panel.appendChild(okBtn);
  }

  private renderError(panel: HTMLElement, context: GameContext, errorMessage: string): void {
    panel.replaceChildren();

    // Error SVG
    const iconWrap = document.createElement("div");
    iconWrap.style.cssText = "margin: 4px auto 16px auto; width: 52px; height: 52px;";
    iconWrap.innerHTML = `
      <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="#f44336" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10" stroke="#f44336" fill="rgba(244, 67, 54, 0.15)"></circle>
        <line x1="15" y1="9" x2="9" y2="15"></line>
        <line x1="9" y1="9" x2="15" y2="15"></line>
      </svg>
    `;
    panel.appendChild(iconWrap);

    // Title
    const title = document.createElement("div");
    title.textContent = "Failed to Add to Library";
    title.style.cssText = "font-size: 18px; font-weight: bold; color: #f44336; margin-bottom: 12px;";
    panel.appendChild(title);

    // Error details card
    const errorCard = document.createElement("div");
    errorCard.style.cssText = `
      background: rgba(244, 67, 54, 0.08); border: 1px solid rgba(244, 67, 54, 0.3);
      border-radius: 3px; padding: 14px; margin-bottom: 20px; text-align: left;
    `;

    const gameEl = document.createElement("div");
    gameEl.textContent = context.title;
    gameEl.style.cssText = "font-size: 14px; font-weight: bold; color: #ffffff; margin-bottom: 6px; word-break: break-word;";
    errorCard.appendChild(gameEl);

    const msgEl = document.createElement("div");
    msgEl.textContent = errorMessage;
    msgEl.style.cssText = "font-size: 13px; color: #f48fb1; word-break: break-word;";
    errorCard.appendChild(msgEl);

    panel.appendChild(errorCard);

    // Button row: Retry & Close
    const btnRow = document.createElement("div");
    btnRow.style.cssText = "display: flex; gap: 10px; justify-content: center;";

    const closeBtn = document.createElement("button");
    closeBtn.textContent = "Close";
    closeBtn.style.cssText = `
      padding: 8px 20px; border: none; border-radius: 3px;
      font-size: 13px; font-family: inherit; cursor: pointer;
      background: #2a475e; color: #d6d7d8; transition: background 0.15s ease;
    `;
    closeBtn.addEventListener("mouseenter", () => { closeBtn.style.background = "#3d6c8e"; });
    closeBtn.addEventListener("mouseleave", () => { closeBtn.style.background = "#2a475e"; });
    closeBtn.addEventListener("click", () => this.close());

    const retryBtn = document.createElement("button");
    retryBtn.textContent = "Retry";
    retryBtn.style.cssText = `
      padding: 8px 20px; border: none; border-radius: 3px;
      font-size: 13px; font-family: inherit; font-weight: bold; cursor: pointer;
      background: #67c1f5; color: #1b2838; transition: background 0.15s ease;
    `;
    retryBtn.addEventListener("mouseenter", () => { retryBtn.style.background = "#8ed4f8"; });
    retryBtn.addEventListener("mouseleave", () => { retryBtn.style.background = "#67c1f5"; });
    retryBtn.addEventListener("click", () => {
      this.executeAddFlow(panel, context);
    });

    btnRow.append(closeBtn, retryBtn);
    panel.appendChild(btnRow);
  }
}

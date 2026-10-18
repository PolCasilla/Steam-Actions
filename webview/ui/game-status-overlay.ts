import type { GameContext } from "../domain/action-item";

const OVERLAY_ID = "steam-actions-game-status-overlay";
const LOG_PREFIX = "[steam-actions:game-status]";

declare const backend: {
  getGameStatus?: (appid: string) => Promise<string>;
};

interface GameStatus {
  ok: boolean;
  appid?: string;
  name?: string;
  installed?: boolean;
  update_pending?: boolean;
  buildid?: number;
  last_updated?: number;
  state_flags?: number;
  error?: string;
}

async function fetchGameStatus(appid: string): Promise<GameStatus> {
  if (typeof backend === "undefined" || typeof backend.getGameStatus !== "function") {
    return { ok: false, error: "Backend RPC unavailable." };
  }
  const raw = await backend.getGameStatus(appid);
  return typeof raw === "string" ? (JSON.parse(raw) as GameStatus) : (raw as GameStatus);
}

/**
 * Modal overlay that shows Steam's local install/update status for the current game.
 * Opens loading → success/error, following the same pattern as AddToLibraryOverlay.
 */
export class GameStatusOverlay {
  private backdrop: HTMLElement | null = null;
  private keyHandler: ((e: KeyboardEvent) => void) | null = null;

  public async open(context: GameContext): Promise<void> {
    console.log(LOG_PREFIX, "Opening for:", context.appId);
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

    this.renderLoading(panel, context);

    try {
      const status = await fetchGameStatus(context.appId);
      if (!status.ok) {
        this.renderError(panel, context, status.error ?? "Unknown error.");
      } else {
        this.renderStatus(panel, context, status);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(LOG_PREFIX, "Error fetching game status:", err);
      this.renderError(panel, context, message);
    }
  }

  public close(): void {
    if (this.keyHandler) {
      window.removeEventListener("keydown", this.keyHandler, true);
      this.keyHandler = null;
    }
    this.backdrop?.remove();
    this.backdrop = null;
  }

  private renderLoading(panel: HTMLElement, context: GameContext): void {
    panel.replaceChildren();

    const spinnerWrap = document.createElement("div");
    spinnerWrap.style.cssText = "margin: 8px auto 20px auto; width: 44px; height: 44px;";
    spinnerWrap.innerHTML = `
      <svg width="44" height="44" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg" stroke="#67c1f5">
        <g fill="none" fill-rule="evenodd">
          <g transform="translate(2 2)" stroke-width="3">
            <circle stroke-opacity=".2" cx="18" cy="18" r="18" stroke="#67c1f5"/>
            <path d="M36 18c0-9.94-8.06-18-18-18">
              <animateTransform attributeName="transform" type="rotate"
                from="0 18 18" to="360 18 18" dur="0.8s" repeatCount="indefinite"/>
            </path>
          </g>
        </g>
      </svg>
    `;
    panel.appendChild(spinnerWrap);

    const title = document.createElement("div");
    title.textContent = "Checking Game Status...";
    title.style.cssText = "font-size: 18px; font-weight: bold; color: #67c1f5; margin-bottom: 8px;";
    panel.appendChild(title);

    const name = document.createElement("div");
    name.textContent = context.title;
    name.style.cssText = "font-size: 14px; color: #ffffff; margin-bottom: 4px; word-break: break-word;";
    panel.appendChild(name);

    const appId = document.createElement("div");
    appId.textContent = `App ID: ${context.appId}`;
    appId.style.cssText = "font-size: 12px; color: #8f98a0;";
    panel.appendChild(appId);
  }

  private renderStatus(panel: HTMLElement, context: GameContext, status: GameStatus): void {
    panel.replaceChildren();

    const installed = status.installed ?? false;
    const updatePending = status.update_pending ?? false;

    const iconColor = installed ? "#4caf50" : "#8f98a0";
    const iconPath = installed
      ? `<polyline points="7 13 10 16 17 9"></polyline>`
      : `<line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line>`;

    const iconWrap = document.createElement("div");
    iconWrap.style.cssText = "margin: 4px auto 16px auto; width: 52px; height: 52px;";
    iconWrap.innerHTML = `
      <svg width="52" height="52" viewBox="0 0 24 24" fill="none"
           stroke="${iconColor}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10" stroke="${iconColor}" fill="${iconColor}22"></circle>
        ${iconPath}
      </svg>
    `;
    panel.appendChild(iconWrap);

    const title = document.createElement("div");
    title.textContent = installed ? "Game is Installed" : "Game Not Installed";
    title.style.cssText = `font-size: 18px; font-weight: bold; color: ${iconColor}; margin-bottom: 12px;`;
    panel.appendChild(title);

    const card = document.createElement("div");
    card.style.cssText = `
      background: rgba(255,255,255,0.04); border: 1px solid #2a475e;
      border-radius: 3px; padding: 14px; margin-bottom: 20px; text-align: left;
    `;

    const rows: [string, string][] = [
      ["Game", status.name ?? context.title],
      ["App ID", context.appId],
      ["Installed", installed ? "Yes" : "No"],
      ["Update Pending", updatePending ? "Yes" : "No"],
    ];
    if (status.buildid) rows.push(["Build ID", String(status.buildid)]);
    if (status.last_updated) {
      rows.push(["Last Updated", new Date(status.last_updated * 1000).toLocaleDateString()]);
    }

    for (const [label, value] of rows) {
      const row = document.createElement("div");
      row.style.cssText = "display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 13px;";
      const lEl = document.createElement("span");
      lEl.textContent = label;
      lEl.style.color = "#8f98a0";
      const vEl = document.createElement("span");
      vEl.textContent = value;
      vEl.style.color = "#c6d4df";
      row.append(lEl, vEl);
      card.appendChild(row);
    }

    if (updatePending) {
      const badge = document.createElement("div");
      badge.textContent = "Steam has an update ready for this game.";
      badge.style.cssText = `
        margin-top: 8px; padding: 6px 10px; border-radius: 3px; font-size: 12px;
        background: rgba(255, 193, 7, 0.12); border: 1px solid rgba(255, 193, 7, 0.3); color: #ffc107;
      `;
      card.appendChild(badge);
    }

    panel.appendChild(card);

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

    const iconWrap = document.createElement("div");
    iconWrap.style.cssText = "margin: 4px auto 16px auto; width: 52px; height: 52px;";
    iconWrap.innerHTML = `
      <svg width="52" height="52" viewBox="0 0 24 24" fill="none"
           stroke="#f44336" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10" stroke="#f44336" fill="rgba(244,67,54,0.15)"></circle>
        <line x1="15" y1="9" x2="9" y2="15"></line>
        <line x1="9" y1="9" x2="15" y2="15"></line>
      </svg>
    `;
    panel.appendChild(iconWrap);

    const title = document.createElement("div");
    title.textContent = "Could Not Get Game Status";
    title.style.cssText = "font-size: 18px; font-weight: bold; color: #f44336; margin-bottom: 12px;";
    panel.appendChild(title);

    const errorCard = document.createElement("div");
    errorCard.style.cssText = `
      background: rgba(244,67,54,0.08); border: 1px solid rgba(244,67,54,0.3);
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
    panel.appendChild(closeBtn);
  }
}

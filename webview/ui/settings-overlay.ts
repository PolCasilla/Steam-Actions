import { makeFocusable, refocusActionTarget, trapModalFocus, type ModalTrap } from "./focusable";

const OVERLAY_ID = "steam-actions-settings-overlay";
const LOG_PREFIX = "[steam-actions:settings]";

declare const backend: {
  getInstalledAppIds?: () => Promise<string[]>;
  hasGameLua?: (appid: string) => Promise<boolean>;
  validateApiKey?: (apiKey: string) => Promise<string>;
  getSettings?: () => Promise<string>;
  clearSettings?: () => Promise<string>;
};

async function validateApiKey(
  apiKey: string,
): Promise<{ status: number; username?: string; daily_usage?: string | number; daily_limit?: string | number }> {
  if (typeof backend !== "undefined" && typeof backend.validateApiKey === "function") {
    try {
      const raw = await backend.validateApiKey(apiKey);
      const data = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (data && typeof data === "object") {
        return {
          status: Number(data.status) || 0,
          username: data.username,
          daily_usage: data.daily_usage,
          daily_limit: data.daily_limit,
        };
      }
    } catch (error) {
      console.error(LOG_PREFIX, "Backend RPC validateApiKey failed:", error);
    }
  }
  return { status: 0 };
}

/**
 * Centered modal overlay for entering and validating an API key.
 */
export class SettingsOverlay {
  private backdrop: HTMLElement | null = null;
  private modalTrap: ModalTrap | null = null;

  public open(): void {
    console.log(LOG_PREFIX, "Opening settings overlay");
    this.close(false);

    const backdrop = document.createElement("div");
    backdrop.id = OVERLAY_ID;
    backdrop.setAttribute("role", "dialog");
    backdrop.setAttribute("aria-modal", "true");
    backdrop.setAttribute("data-panel", '{"flow-children":"column","autoFocus":true}');
    backdrop.style.cssText = `
      position: fixed; inset: 0; z-index: 2147483647;
      display: flex; align-items: center; justify-content: center;
      background: rgba(0, 0, 0, 0.6);
      font-family: "Motiva Sans", Arial, Helvetica, sans-serif;
    `;

    const panel = document.createElement("div");
    panel.setAttribute("data-panel", '{"flow-children":"column"}');
    panel.style.cssText = `
      background: #1b2838; border: 1px solid #4c6b88; border-radius: 4px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.8);
      padding: 24px; min-width: 340px; max-width: 420px; color: #d6d7d8;
    `;

    // Title
    const title = document.createElement("div");
    title.textContent = "Settings";
    title.style.cssText = "font-size: 18px; font-weight: bold; color: #67c1f5; margin-bottom: 20px;";
    panel.appendChild(title);

    // Label
    const label = document.createElement("label");
    label.textContent = "API Key";
    label.style.cssText = `
      display: block; font-size: 12px; color: #8f98a0;
      margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px;
    `;
    panel.appendChild(label);

    // Input
    const input = document.createElement("input");
    input.type = "password";
    input.placeholder = "Enter your API key";
    input.style.cssText = `
      width: 100%; padding: 10px 12px; background: #2a475e;
      border: 2px solid #4c6b88; border-radius: 4px;
      color: #d6d7d8; font-size: 14px; font-family: inherit;
      outline: none; box-sizing: border-box; margin-bottom: 16px;
      transition: border-color 0.15s ease, box-shadow 0.15s ease;
    `;
    makeFocusable(input, {
      baseBg: "#2a475e",
      hoverBg: "#325672",
      borderColor: "#4c6b88",
      focusBorderColor: "#67c1f5",
    });
    input.addEventListener("focus", () => {
      const win = typeof window !== "undefined" ? (window as any) : null;
      if (win && typeof win.GPShowVirtualKeyboard === "function") {
        try { win.GPShowVirtualKeyboard(true); } catch {}
      }
    });
    input.addEventListener("blur", () => {
      const win = typeof window !== "undefined" ? (window as any) : null;
      if (win && typeof win.GPShowVirtualKeyboard === "function") {
        try { win.GPShowVirtualKeyboard(false); } catch {}
      }
    });
    panel.appendChild(input);

    // Result area
    const resultArea = document.createElement("div");
    resultArea.style.display = "none";
    panel.appendChild(resultArea);

    // Buttons
    const buttonRow = document.createElement("div");
    buttonRow.setAttribute("data-panel", '{"flow-children":"row"}');
    buttonRow.style.cssText = "display: flex; gap: 10px; justify-content: flex-end;";

    const makeBtn = (text: string, primary: boolean, autoFocus = false): HTMLButtonElement => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = text;
      const bg = primary ? "#67c1f5" : "#2a475e";
      const bgHover = primary ? "#8ed4f8" : "#3d6c8e";
      btn.style.cssText = `
        padding: 8px 20px; border: 2px solid transparent; border-radius: 4px;
        font-size: 13px; font-family: inherit; cursor: pointer;
        box-sizing: border-box;
        transition: background 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
        background: ${bg}; color: ${primary ? "#1b2838" : "#d6d7d8"};
        ${primary ? "font-weight: bold;" : ""}
      `;
      makeFocusable(btn, {
        baseBg: bg,
        hoverBg: bgHover,
        focusBorderColor: primary ? "#ffffff" : "#67c1f5",
        autoFocus,
      });
      return btn;
    };

    const cancelBtn = makeBtn("Cancel", false, true);
    cancelBtn.addEventListener("click", () => this.close());

    let isSaving = false;
    const saveBtn = makeBtn("Save", true);
    saveBtn.addEventListener("click", async () => {
      if (isSaving) return;
      const key = input.value.trim();
      if (!key) {
        console.warn(LOG_PREFIX, "Save clicked with empty API key");
        this.showError(resultArea);
        return;
      }

      console.log(LOG_PREFIX, "Save clicked, validating...");
      isSaving = true;
      saveBtn.textContent = "Saving...";
      saveBtn.style.opacity = "0.6";

      const result = await validateApiKey(key);

      saveBtn.textContent = "Save";
      saveBtn.style.opacity = "";
      isSaving = false;

      if (result.status === 200) {
        console.log(LOG_PREFIX, "Showing success result");
        this.showSuccess(resultArea, result.username || "—", result.daily_usage, result.daily_limit);
      } else {
        console.warn(LOG_PREFIX, "Showing error result, status:", result.status);
        this.showError(resultArea);
      }
    });

    // 2D directional navigation between input and buttons
    input.addEventListener("keydown", (e: KeyboardEvent) => {
      if (e.key === "ArrowDown" || e.key === "Down") {
        e.preventDefault();
        cancelBtn.focus();
      } else if (e.key === "Enter") {
        e.preventDefault();
        saveBtn.click();
      }
    });

    cancelBtn.addEventListener("keydown", (e: KeyboardEvent) => {
      if (e.key === "ArrowUp" || e.key === "Up") {
        e.preventDefault();
        input.focus();
      } else if (e.key === "ArrowRight" || e.key === "Right") {
        e.preventDefault();
        saveBtn.focus();
      }
    });

    saveBtn.addEventListener("keydown", (e: KeyboardEvent) => {
      if (e.key === "ArrowUp" || e.key === "Up") {
        e.preventDefault();
        input.focus();
      } else if (e.key === "ArrowLeft" || e.key === "Left") {
        e.preventDefault();
        cancelBtn.focus();
      }
    });

    buttonRow.appendChild(cancelBtn);
    buttonRow.appendChild(saveBtn);
    panel.appendChild(buttonRow);

    // Dismiss on outside click
    backdrop.addEventListener("pointerdown", (e) => {
      if (e.target === backdrop) this.close();
    });

    backdrop.appendChild(panel);
    document.body.appendChild(backdrop);
    this.backdrop = backdrop;

    // Trap focus and suspend background store elements immediately and synchronously
    this.modalTrap = trapModalFocus(backdrop, cancelBtn, () => this.close());

    // Asynchronously load settings without delaying modal mount or focus
    this.loadSavedSettings(input, resultArea);
  }

  public close(refocus = true): void {
    if (this.backdrop) {
      console.log(LOG_PREFIX, "Closing settings overlay");
    }
    if (this.modalTrap) {
      this.modalTrap.release();
      this.modalTrap = null;
    }
    this.backdrop?.remove();
    this.backdrop = null;
    if (refocus) {
      refocusActionTarget();
    }
  }

  private async loadSavedSettings(input: HTMLInputElement, resultArea: HTMLElement): Promise<void> {
    if (typeof backend === "undefined" || typeof backend.getSettings !== "function") {
      return;
    }

    try {
      const rawSettings = await backend.getSettings();
      const settings = typeof rawSettings === "string" ? JSON.parse(rawSettings) : rawSettings;
      if (settings && settings.has_key) {
        input.placeholder = settings.masked_key || "••••••••";

        if (settings.username) {
          this.showSuccess(resultArea, settings.username, settings.daily_usage, settings.daily_limit);
        } else {
          this.showLoading(resultArea);
        }

        validateApiKey("").then((res) => {
          if (res.status === 200 && res.username) {
            this.showSuccess(resultArea, res.username, res.daily_usage, res.daily_limit);
          } else if (res.status === 401 || res.status === 403) {
            this.showError(resultArea, "API Key Expired or Invalid");
          }
        }).catch((err) => {
          console.warn(LOG_PREFIX, "Failed refreshing user stats on open:", err);
        });
      } else if (settings && settings.expired) {
        console.warn(LOG_PREFIX, "Saved API key was expired and has been cleared.");
        input.placeholder = "Enter your API key";
        resultArea.style.display = "none";
      }
    } catch (err) {
      console.warn(LOG_PREFIX, "Could not fetch existing settings:", err);
    }
  }

  private showLoading(container: HTMLElement): void {
    container.replaceChildren();
    container.style.cssText = `
      display: flex; align-items: center; gap: 8px; margin-bottom: 16px; padding: 12px 14px;
      background: rgba(103, 193, 245, 0.08); border: 1px solid #4c6b88; border-radius: 3px;
      color: #8f98a0; font-size: 13px;
    `;
    const label = document.createElement("span");
    label.textContent = "Fetching user details...";
    container.appendChild(label);
  }

  private showSuccess(
    container: HTMLElement,
    username: string,
    dailyUsage?: string | number,
    dailyLimit?: string | number,
  ): void {
    container.replaceChildren();
    container.style.cssText = `
      display: block; margin-bottom: 16px; padding: 14px;
      background: rgba(76, 175, 80, 0.1); border: 1px solid #4caf50; border-radius: 3px;
    `;

    const header = document.createElement("div");
    header.textContent = "✓ Connected";
    header.style.cssText = "color: #4caf50; font-weight: bold; margin-bottom: 10px; font-size: 13px;";
    container.appendChild(header);

    const addRow = (label: string, value: string): void => {
      const row = document.createElement("div");
      row.style.cssText = "display: flex; justify-content: space-between; margin-bottom: 6px;";
      const labelEl = document.createElement("span");
      labelEl.textContent = label;
      labelEl.style.cssText = "color: #8f98a0; font-size: 12px; text-transform: uppercase;";
      const valueEl = document.createElement("span");
      valueEl.textContent = value;
      valueEl.style.cssText = "color: #d6d7d8; font-size: 14px; font-weight: 500;";
      row.append(labelEl, valueEl);
      container.appendChild(row);
    };

    const usageDisplay =
      dailyLimit !== undefined && dailyLimit !== null && dailyLimit !== ""
        ? `${dailyUsage ?? 0} / ${dailyLimit}`
        : `${dailyUsage ?? "—"}`;

    addRow("Username", username);
    addRow("Usage", usageDisplay);
  }

  private showError(container: HTMLElement, message: string = "✗ Invalid API Key"): void {
    container.replaceChildren();
    container.style.cssText = `
      display: block; margin-bottom: 16px; padding: 14px;
      background: rgba(244, 67, 54, 0.1); border: 1px solid #f44336; border-radius: 3px;
    `;
    const msg = document.createElement("div");
    msg.textContent = message;
    msg.style.cssText = "color: #f44336; font-weight: bold; font-size: 13px;";
    container.appendChild(msg);
  }
}

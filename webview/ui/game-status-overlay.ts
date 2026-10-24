import type { GameContext } from "../domain/action-item";

const OVERLAY_ID = "steam-actions-game-status-overlay";
const LOG_PREFIX = "[steam-actions:game-status]";

declare const backend: {
  getGameStatus?: (appid: string) => Promise<string>;
  deployEmulator?: (appid: string) => Promise<string>;
  restoreOriginal?: (appid: string) => Promise<string>;
  exportEmulatorZip?: (appid: string, destPath?: string) => Promise<string>;
  downloadEmulatorToolchain?: () => Promise<string>;
};

interface EmulatorStatus {
  toolchain_ready: boolean;
  missing_dlls?: string[];
  is_cracked?: boolean;
  needs_recrack?: boolean;
  has_backup?: boolean;
  crack_buildid?: number;
  exe_path?: string;
  exe_name?: string;
  rel_dir?: string;
  arch?: string;
  is_unreal?: boolean;
  steam_api_path?: string;
  steam_api_exists?: boolean;
  steam_api_is_emu?: boolean;
}

interface GameStatus {
  ok: boolean;
  appid?: string;
  name?: string;
  installed?: boolean;
  update_pending?: boolean;
  buildid?: number;
  target_buildid?: number;
  last_updated?: number;
  state_flags?: number;
  installdir?: string;
  install_path?: string;
  emu?: EmulatorStatus;
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
 * Unified modal overlay that shows Steam's local install/update status AND
 * offline emulator crack status, complete with AV warnings and deployment controls.
 */
export class GameStatusOverlay {
  private backdrop: HTMLElement | null = null;
  private keyHandler: ((e: KeyboardEvent) => void) | null = null;

  public async open(context: GameContext): Promise<void> {
    console.log(LOG_PREFIX, "Opening unified dashboard for:", context.appId);
    this.close();

    const backdrop = document.createElement("div");
    backdrop.id = OVERLAY_ID;
    backdrop.style.cssText = `
      position: fixed; inset: 0; z-index: 2147483647;
      display: flex; align-items: center; justify-content: center;
      background: rgba(0, 0, 0, 0.75);
      font-family: "Motiva Sans", Arial, Helvetica, sans-serif;
    `;

    const panel = document.createElement("div");
    panel.style.cssText = `
      background: #1b2838; border: 1px solid #4c6b88; border-radius: 4px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.85);
      padding: 24px; width: 480px; max-width: 90vw; color: #d6d7d8;
      box-sizing: border-box; text-align: left; max-height: 85vh; overflow-y: auto;
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
    spinnerWrap.style.cssText = "margin: 20px auto; width: 44px; height: 44px; text-align: center;";
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
    title.textContent = "Checking Game & Crack Status...";
    title.style.cssText = "font-size: 16px; font-weight: bold; color: #67c1f5; text-align: center; margin-bottom: 8px;";
    panel.appendChild(title);

    const name = document.createElement("div");
    name.textContent = context.title;
    name.style.cssText = "font-size: 13px; color: #ffffff; text-align: center;";
    panel.appendChild(name);
  }

  private renderStatus(panel: HTMLElement, context: GameContext, status: GameStatus): void {
    panel.replaceChildren();

    const installed = status.installed ?? false;
    const updatePending = status.update_pending ?? false;
    const emu = status.emu;
    const isCracked = emu?.is_cracked ?? false;

    // Header Title
    const title = document.createElement("div");
    title.textContent = "Game & Emulator Status";
    title.style.cssText = "font-size: 18px; font-weight: bold; color: #67c1f5; margin-bottom: 4px;";
    panel.appendChild(title);

    const sub = document.createElement("div");
    sub.textContent = `${status.name ?? context.title} (App ID: ${context.appId})`;
    sub.style.cssText = "font-size: 12px; color: #8f98a0; margin-bottom: 16px;";
    panel.appendChild(sub);

    // 1. Antivirus / Missing Toolchain Card (if flagged)
    if (emu && !emu.toolchain_ready) {
      const avCard = document.createElement("div");
      avCard.style.cssText = `
        background: rgba(255, 152, 0, 0.12); border: 1px solid rgba(255, 152, 0, 0.4);
        border-radius: 4px; padding: 12px; margin-bottom: 16px; font-size: 12px; color: #ffb74d;
      `;
      avCard.innerHTML = `
        <div style="font-weight: bold; font-size: 13px; margin-bottom: 4px;">⚠ Antivirus Alert: Emulator Files Missing / Quarantined</div>
        <div style="margin-bottom: 8px; color: #d6d7d8;">Windows Defender often flags Steam emulators (steamclient64.dll) as false positives. Add an exclusion for the plugin data folder before downloading.</div>
      `;

      const btnRow = document.createElement("div");
      btnRow.style.cssText = "display: flex; gap: 8px;";

      const dlBtn = document.createElement("button");
      dlBtn.textContent = "Re-download Emu Files";
      dlBtn.style.cssText = `
        padding: 5px 12px; border: none; border-radius: 2px;
        background: #ff9800; color: #1b2838; font-weight: bold; font-size: 12px; cursor: pointer;
      `;
      dlBtn.addEventListener("click", async () => {
        dlBtn.textContent = "Downloading...";
        try {
          if (backend.downloadEmulatorToolchain) {
            await backend.downloadEmulatorToolchain();
            const fresh = await fetchGameStatus(context.appId);
            this.renderStatus(panel, context, fresh);
          }
        } catch {
          dlBtn.textContent = "Download Failed";
        }
      });
      btnRow.appendChild(dlBtn);
      avCard.appendChild(btnRow);
      panel.appendChild(avCard);
    }

    // 2. Steam Status Card
    const steamCard = document.createElement("div");
    steamCard.style.cssText = `
      background: rgba(255,255,255,0.03); border: 1px solid #2a475e;
      border-radius: 3px; padding: 12px; margin-bottom: 12px;
    `;

    const statusRows: [string, string, string?][] = [
      ["Steam Installed", installed ? "Yes" : "No", installed ? "#4caf50" : "#f44336"],
      ["Steam Updates", updatePending ? "Update Pending" : "Up to Date", updatePending ? "#ffc107" : "#4caf50"],
    ];
    if (status.buildid) statusRows.push(["Current Build ID", String(status.buildid)]);
    if (status.target_buildid) statusRows.push(["Target Build ID", String(status.target_buildid), "#ffc107"]);
    if (status.installdir) statusRows.push(["Install Folder", status.installdir]);

    for (const [lbl, val, col] of statusRows) {
      const row = document.createElement("div");
      row.style.cssText = "display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 12px;";
      const l = document.createElement("span");
      l.textContent = lbl;
      l.style.color = "#8f98a0";
      const v = document.createElement("span");
      v.textContent = val;
      v.style.color = col || "#c6d4df";
      v.style.fontWeight = col ? "bold" : "normal";
      row.append(l, v);
      steamCard.appendChild(row);
    }

    // Warning if update pending
    if (updatePending) {
      const warnBox = document.createElement("div");
      warnBox.textContent = "⚠ Steam has an update pending. Updating after applying a crack will wipe emulator files.";
      warnBox.style.cssText = `
        margin-top: 8px; padding: 6px 10px; border-radius: 2px; font-size: 11px;
        background: rgba(255, 193, 7, 0.12); border: 1px solid rgba(255, 193, 7, 0.3); color: #ffc107;
      `;
      steamCard.appendChild(warnBox);
    }

    // Warning if game not installed
    if (!installed) {
      const uninstalledBox = document.createElement("div");
      uninstalledBox.textContent = "Game files are not on disk. Install via Steam before applying the emulator crack.";
      uninstalledBox.style.cssText = `
        margin-top: 8px; padding: 6px 10px; border-radius: 2px; font-size: 11px;
        background: rgba(244, 67, 54, 0.1); border: 1px solid rgba(244, 67, 54, 0.3); color: #f48fb1;
      `;
      steamCard.appendChild(uninstalledBox);
    }

    panel.appendChild(steamCard);

    // 3. Emulator & Crack Card (if installed)
    if (installed) {
      const emuCard = document.createElement("div");
      emuCard.style.cssText = `
        background: rgba(255,255,255,0.03); border: 1px solid #2a475e;
        border-radius: 3px; padding: 12px; margin-bottom: 16px;
      `;

      const crackStatusLabel = isCracked ? "Cracked (ColdLoader + gbe_fork)" : "Genuine Steam (Uncracked)";
      const crackStatusColor = isCracked ? "#4caf50" : "#8f98a0";

      const emuRows: [string, string, string?][] = [
        ["Offline Crack", crackStatusLabel, crackStatusColor],
        ["Target Binary", emu?.exe_name ? `${emu.exe_name} (${emu.arch || "x64"})` : "Not Found"],
        ["Original steam_api", emu?.has_backup ? "Backed up (.bak)" : (emu?.steam_api_exists ? "Present" : "Missing")],
      ];

      for (const [lbl, val, col] of emuRows) {
        const row = document.createElement("div");
        row.style.cssText = "display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 12px;";
        const l = document.createElement("span");
        l.textContent = lbl;
        l.style.color = "#8f98a0";
        const v = document.createElement("span");
        v.textContent = val;
        v.style.color = col || "#c6d4df";
        v.style.fontWeight = col ? "bold" : "normal";
        row.append(l, v);
        emuCard.appendChild(row);
      }

      if (emu?.needs_recrack) {
        const recrackNotice = document.createElement("div");
        recrackNotice.textContent = "Steam updated this game recently. Re-apply crack to update interface bindings.";
        recrackNotice.style.cssText = `
          margin-top: 8px; padding: 6px 10px; border-radius: 2px; font-size: 11px;
          background: rgba(33, 150, 243, 0.12); border: 1px solid rgba(33, 150, 243, 0.3); color: #64b5f6;
        `;
        emuCard.appendChild(recrackNotice);
      }

      panel.appendChild(emuCard);
    }

    // 4. Action Buttons
    const actionsRow = document.createElement("div");
    actionsRow.style.cssText = "display: flex; gap: 8px; justify-content: flex-end; flex-wrap: wrap;";

    const statusMsg = document.createElement("div");
    statusMsg.style.cssText = "width: 100%; font-size: 12px; margin-bottom: 8px; display: none;";
    panel.appendChild(statusMsg);

    const showMsg = (txt: string, isErr = false) => {
      statusMsg.style.display = "block";
      statusMsg.style.color = isErr ? "#f44336" : "#4caf50";
      statusMsg.textContent = txt;
    };

    if (installed) {
      // Crack button
      const crackBtn = document.createElement("button");
      crackBtn.textContent = isCracked ? "Re-apply Crack" : "Apply Offline Crack";
      crackBtn.style.cssText = `
        padding: 8px 16px; border: none; border-radius: 2px; font-size: 12px; font-weight: bold;
        background: #4caf50; color: #ffffff; cursor: pointer; transition: opacity 0.15s ease;
      `;
      crackBtn.addEventListener("click", async () => {
        crackBtn.textContent = "Applying Crack...";
        crackBtn.style.opacity = "0.7";
        try {
          if (backend.deployEmulator) {
            const raw = await backend.deployEmulator(context.appId);
            const res = typeof raw === "string" ? JSON.parse(raw) : raw;
            if (res.success) {
              showMsg("Offline crack applied successfully! Original files backed up as .bak.");
              const fresh = await fetchGameStatus(context.appId);
              this.renderStatus(panel, context, fresh);
            } else {
              showMsg(res.message || "Failed to apply crack.", true);
              crackBtn.textContent = isCracked ? "Re-apply Crack" : "Apply Offline Crack";
              crackBtn.style.opacity = "1";
            }
          }
        } catch (e: any) {
          showMsg(e.message || "Deploy error", true);
          crackBtn.textContent = isCracked ? "Re-apply Crack" : "Apply Offline Crack";
          crackBtn.style.opacity = "1";
        }
      });
      actionsRow.appendChild(crackBtn);

      // Restore button (if cracked or backup exists)
      if (isCracked || emu?.has_backup) {
        const restoreBtn = document.createElement("button");
        restoreBtn.textContent = "Restore Original";
        restoreBtn.style.cssText = `
          padding: 8px 14px; border: none; border-radius: 2px; font-size: 12px; font-weight: bold;
          background: #f44336; color: #ffffff; cursor: pointer;
        `;
        restoreBtn.addEventListener("click", async () => {
          restoreBtn.textContent = "Restoring...";
          try {
            if (backend.restoreOriginal) {
              const raw = await backend.restoreOriginal(context.appId);
              const res = typeof raw === "string" ? JSON.parse(raw) : raw;
              if (res.success) {
                showMsg("Original files restored and crack removed.");
                const fresh = await fetchGameStatus(context.appId);
                this.renderStatus(panel, context, fresh);
              } else {
                showMsg(res.message || "Restore failed", true);
              }
            }
          } catch (e: any) {
            showMsg(e.message || "Restore error", true);
          }
        });
        actionsRow.appendChild(restoreBtn);
      }

      // Export ZIP button
      const zipBtn = document.createElement("button");
      zipBtn.textContent = "Export ZIP";
      zipBtn.style.cssText = `
        padding: 8px 14px; border: none; border-radius: 2px; font-size: 12px;
        background: #2a475e; color: #67c1f5; cursor: pointer;
      `;
      zipBtn.addEventListener("click", async () => {
        zipBtn.textContent = "Exporting...";
        try {
          if (backend.exportEmulatorZip) {
            const raw = await backend.exportEmulatorZip(context.appId);
            const res = typeof raw === "string" ? JSON.parse(raw) : raw;
            if (res.success) {
              showMsg(`Crack ZIP created: ${res.zip_path || "in downloads folder"}`);
            } else {
              showMsg(res.message || "Export failed", true);
            }
          }
        } catch (e: any) {
          showMsg(e.message || "Export error", true);
        } finally {
          zipBtn.textContent = "Export ZIP";
        }
      });
      actionsRow.appendChild(zipBtn);
    }

    // Close button
    const closeBtn = document.createElement("button");
    closeBtn.textContent = "Close";
    closeBtn.style.cssText = `
      padding: 8px 16px; border: none; border-radius: 2px; font-size: 12px;
      background: #2a475e; color: #d6d7d8; cursor: pointer;
    `;
    closeBtn.addEventListener("click", () => this.close());
    actionsRow.appendChild(closeBtn);

    panel.appendChild(actionsRow);
  }

  private renderError(panel: HTMLElement, context: GameContext, errorMessage: string): void {
    panel.replaceChildren();

    const title = document.createElement("div");
    title.textContent = "Could Not Get Status";
    title.style.cssText = "font-size: 16px; font-weight: bold; color: #f44336; margin-bottom: 8px;";
    panel.appendChild(title);

    const errorCard = document.createElement("div");
    errorCard.style.cssText = `
      background: rgba(244,67,54,0.08); border: 1px solid rgba(244,67,54,0.3);
      border-radius: 3px; padding: 12px; margin-bottom: 16px; font-size: 13px; color: #f48fb1;
    `;
    errorCard.textContent = errorMessage;
    panel.appendChild(errorCard);

    const closeBtn = document.createElement("button");
    closeBtn.textContent = "Close";
    closeBtn.style.cssText = `
      padding: 8px 18px; border: none; border-radius: 2px;
      background: #2a475e; color: #d6d7d8; cursor: pointer;
    `;
    closeBtn.addEventListener("click", () => this.close());
    panel.appendChild(closeBtn);
  }
}

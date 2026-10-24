import { ModalRoot, showModal, Millennium } from "millennium";
import type { GameContext, SettingsData, RpcResult } from "./types";
import {
  theme,
  modalContainerStyle,
  btnBase,
  btnPrimary,
  btnSecondary,
  btnDanger,
  inputStyle,
  statusCardSuccess,
  statusCardDanger,
} from "./ui/styles";
import { SpinnerIcon, SuccessIcon, ErrorIcon, WarningIcon } from "./ui/icons";

const React = (globalThis as any).SP_REACT;

async function callRpc<T = any>(method: string, params?: any): Promise<T> {
  if (typeof (Millennium as any).callServerMethod !== "function") {
    throw new Error("Millennium backend RPC is not available.");
  }
  const raw = await (Millennium as any).callServerMethod(method, params);
  return typeof raw === "string" ? JSON.parse(raw) : raw;
}

// -------------------------------------------------------------
// 1. Actions Modal
// -------------------------------------------------------------
function MenuItemButton({ label, onClick }: { label: string; onClick: () => void }) {
  const [hover, setHover] = React.useState(false);
  return React.createElement(
    "div",
    {
      style: {
        padding: "10px 16px",
        cursor: "pointer",
        borderRadius: "2px",
        color: hover ? "#ffffff" : theme.text,
        background: hover ? theme.cardBg : "transparent",
        fontSize: "14px",
      },
      onMouseEnter: () => setHover(true),
      onMouseLeave: () => setHover(false),
      onClick,
    },
    label
  );
}

function ActionsModalContent({
  context,
  closeModal,
}: {
  context: GameContext;
  closeModal: () => void;
}) {
  return React.createElement(
    ModalRoot,
    { closeModal, bDisableBackgroundDismiss: false },
    React.createElement(
      "div",
      {
        style: {
          padding: "20px",
          minWidth: "320px",
          background: theme.bg,
          color: theme.text,
          fontFamily: theme.font,
        },
      },
      React.createElement(
        "div",
        {
          style: {
            fontSize: "16px",
            fontWeight: "bold",
            marginBottom: "16px",
            color: theme.primary,
          },
        },
        `Actions: ${context.title}`
      ),
      React.createElement(MenuItemButton, {
        label: "Game Status",
        onClick: () => {
          closeModal();
          openGameStatusModal(context);
        },
      }),
      React.createElement(MenuItemButton, {
        label: "Add to Library",
        onClick: () => {
          closeModal();
          openAddToLibraryModal(context);
        },
      }),
      React.createElement(MenuItemButton, {
        label: "Remove from Library",
        onClick: () => {
          closeModal();
          openRemoveFromLibraryModal(context);
        },
      }),
      React.createElement(MenuItemButton, {
        label: "Settings",
        onClick: () => {
          closeModal();
          openSettingsModal();
        },
      }),
      React.createElement("div", {
        style: { height: "1px", background: theme.cardBg, margin: "8px 0" },
      }),
      React.createElement(MenuItemButton, {
        label: "Close",
        onClick: closeModal,
      })
    )
  );
}

export function openActionsModal(context: GameContext): void {
  let modalHandle: any;
  modalHandle = showModal(
    React.createElement(ActionsModalContent, {
      context,
      closeModal: () => modalHandle?.Close?.(),
    }),
    undefined,
    { strTitle: "Game Actions", popupWidth: 400, popupHeight: 320, bForcePopOut: false }
  );
}

// -------------------------------------------------------------
// 2. Add To Library Modal
// -------------------------------------------------------------
function AddToLibraryModalContent({
  context,
  closeModal,
}: {
  context: GameContext;
  closeModal: () => void;
}) {
  const [state, setState] = React.useState<"loading" | "success" | "error">("loading");
  const [result, setResult] = React.useState<RpcResult | null>(null);
  const [errorMessage, setErrorMessage] = React.useState<string>("");

  const executeAdd = React.useCallback(async () => {
    setState("loading");
    setErrorMessage("");
    try {
      const data: RpcResult = await callRpc("addToLibrary", {
        app_id: context.appId,
        title: context.title,
      });
      if (data && data.success) {
        setResult(data);
        setState("success");
        return;
      }
      throw new Error(data?.message || "Failed to add game to library.");
    } catch (err: any) {
      setErrorMessage(err?.message || "Failed to add game to library.");
      setState("error");
    }
  }, [context.appId, context.title]);

  React.useEffect(() => {
    executeAdd();
  }, [executeAdd]);

  return React.createElement(
    ModalRoot,
    { closeModal, bDisableBackgroundDismiss: false },
    React.createElement(
      "div",
      { style: modalContainerStyle },
      state === "loading" &&
        React.createElement(
          "div",
          null,
          React.createElement(SpinnerIcon),
          React.createElement(
            "div",
            { style: { fontSize: "18px", fontWeight: "bold", color: theme.primary, marginBottom: "8px" } },
            "Adding to Library..."
          ),
          React.createElement("div", { style: { fontSize: "14px", color: "#ffffff", marginBottom: "4px" } }, context.title),
          React.createElement("div", { style: { fontSize: "12px", color: theme.textMuted, marginBottom: "16px" } }, `App ID: ${context.appId}`),
          React.createElement("div", { style: { fontSize: "13px", color: theme.textMuted } }, "Connecting to API, please wait...")
        ),
      state === "success" &&
        React.createElement(
          "div",
          null,
          React.createElement(SuccessIcon),
          React.createElement(
            "div",
            { style: { fontSize: "18px", fontWeight: "bold", color: theme.success, marginBottom: "12px" } },
            "Added to Library"
          ),
          React.createElement(
            "div",
            { style: statusCardSuccess },
            React.createElement("div", { style: { fontSize: "14px", fontWeight: "bold", color: "#ffffff", marginBottom: "4px" } }, context.title),
            React.createElement("div", { style: { fontSize: "13px", color: "#c6d4df", marginBottom: "6px" } }, "This game is now added to your Steam library."),
            React.createElement("div", { style: { fontSize: "12px", color: theme.textMuted, marginBottom: "8px" } }, `App ID: ${context.appId}`),
            React.createElement(
              "div",
              {
                style: {
                  borderTop: "1px solid rgba(255, 255, 255, 0.08)",
                  paddingTop: "8px",
                  fontSize: "12px",
                  color: "#c6d4df",
                  lineHeight: "1.6",
                },
              },
              React.createElement("div", null, `• ${result?.manifest_count ?? 0} manifest file(s) installed`),
              React.createElement("div", null, `• ${result?.lua_count ?? 0} lua script installed`)
            )
          ),
          React.createElement("button", { onClick: closeModal, style: btnPrimary }, "OK")
        ),
      state === "error" &&
        React.createElement(
          "div",
          null,
          React.createElement(ErrorIcon),
          React.createElement(
            "div",
            { style: { fontSize: "18px", fontWeight: "bold", color: theme.danger, marginBottom: "12px" } },
            "Failed to Add to Library"
          ),
          React.createElement(
            "div",
            { style: statusCardDanger },
            React.createElement("div", { style: { fontSize: "14px", fontWeight: "bold", color: "#ffffff", marginBottom: "6px" } }, context.title),
            React.createElement("div", { style: { fontSize: "13px", color: "#f48fb1", wordBreak: "break-word" as const } }, errorMessage)
          ),
          React.createElement(
            "div",
            { style: { display: "flex", gap: "10px", justifyContent: "center" } },
            React.createElement("button", { onClick: closeModal, style: btnSecondary }, "Close"),
            React.createElement("button", { onClick: executeAdd, style: btnPrimary }, "Retry")
          )
        )
    )
  );
}

export function openAddToLibraryModal(context: GameContext): void {
  let modalHandle: any;
  modalHandle = showModal(
    React.createElement(AddToLibraryModalContent, {
      context,
      closeModal: () => modalHandle?.Close?.(),
    }),
    undefined,
    { strTitle: "Add to Library", popupWidth: 420, popupHeight: 340, bForcePopOut: false }
  );
}

// -------------------------------------------------------------
// 3. Remove From Library Modal
// -------------------------------------------------------------
function RemoveFromLibraryModalContent({
  context,
  closeModal,
}: {
  context: GameContext;
  closeModal: () => void;
}) {
  const [state, setState] = React.useState<"confirm" | "loading" | "success" | "error">("confirm");
  const [errorMessage, setErrorMessage] = React.useState<string>("");

  const executeRemove = React.useCallback(async () => {
    setState("loading");
    setErrorMessage("");
    try {
      const data: RpcResult = await callRpc("removeFromLibrary", {
        app_id: context.appId,
        title: context.title,
      });
      if (data && data.success) {
        setState("success");
        return;
      }
      throw new Error(data?.message || "Failed to remove game.");
    } catch (err: any) {
      setErrorMessage(err?.message || "Failed to remove game.");
      setState("error");
    }
  }, [context.appId, context.title]);

  return React.createElement(
    ModalRoot,
    { closeModal, bDisableBackgroundDismiss: state === "loading" },
    React.createElement(
      "div",
      { style: modalContainerStyle },
      state === "confirm" &&
        React.createElement(
          "div",
          null,
          React.createElement(WarningIcon),
          React.createElement(
            "div",
            { style: { fontSize: "18px", fontWeight: "bold", color: "#ffffff", marginBottom: "12px" } },
            "Remove from Library?"
          ),
          React.createElement(
            "div",
            {
              style: {
                background: "rgba(42, 71, 94, 0.4)",
                border: "1px solid #4c6b88",
                borderRadius: "3px",
                padding: "14px",
                marginBottom: "20px",
                textAlign: "left" as const,
              },
            },
            React.createElement("div", { style: { fontSize: "14px", fontWeight: "bold", color: theme.primary, marginBottom: "4px" } }, context.title),
            React.createElement("div", { style: { fontSize: "13px", color: "#c6d4df", marginBottom: "6px", lineHeight: "1.4" } }, "Are you sure you want to remove this game? This will remove its script file from your stplug-in directory."),
            React.createElement("div", { style: { fontSize: "12px", color: theme.textMuted } }, `App ID: ${context.appId}`)
          ),
          React.createElement(
            "div",
            { style: { display: "flex", gap: "10px", justifyContent: "flex-end" } },
            React.createElement("button", { onClick: closeModal, style: btnSecondary }, "Cancel"),
            React.createElement("button", { onClick: executeRemove, style: btnDanger }, "Remove")
          )
        ),
      state === "loading" &&
        React.createElement(
          "div",
          null,
          React.createElement(SpinnerIcon),
          React.createElement(
            "div",
            { style: { fontSize: "18px", fontWeight: "bold", color: theme.primary, marginBottom: "8px" } },
            "Removing from Library..."
          ),
          React.createElement("div", { style: { fontSize: "14px", color: "#ffffff", marginBottom: "4px" } }, context.title),
          React.createElement("div", { style: { fontSize: "12px", color: theme.textMuted, marginBottom: "16px" } }, `App ID: ${context.appId}`),
          React.createElement("div", { style: { fontSize: "13px", color: theme.textMuted } }, "Deleting plugin files, please wait...")
        ),
      state === "success" &&
        React.createElement(
          "div",
          null,
          React.createElement(SuccessIcon),
          React.createElement(
            "div",
            { style: { fontSize: "18px", fontWeight: "bold", color: theme.success, marginBottom: "12px" } },
            "Removed from Library"
          ),
          React.createElement(
            "div",
            { style: statusCardSuccess },
            React.createElement("div", { style: { fontSize: "14px", fontWeight: "bold", color: "#ffffff", marginBottom: "4px" } }, context.title),
            React.createElement("div", { style: { fontSize: "13px", color: "#c6d4df", marginBottom: "6px" } }, "This game has been removed from your library folder."),
            React.createElement("div", { style: { fontSize: "12px", color: theme.textMuted } }, `App ID: ${context.appId}`)
          ),
          React.createElement("button", { onClick: closeModal, style: btnPrimary }, "OK")
        ),
      state === "error" &&
        React.createElement(
          "div",
          null,
          React.createElement(ErrorIcon),
          React.createElement(
            "div",
            { style: { fontSize: "18px", fontWeight: "bold", color: theme.danger, marginBottom: "12px" } },
            "Failed to Remove from Library"
          ),
          React.createElement(
            "div",
            { style: statusCardDanger },
            React.createElement("div", { style: { fontSize: "14px", fontWeight: "bold", color: "#ffffff", marginBottom: "6px" } }, context.title),
            React.createElement("div", { style: { fontSize: "13px", color: "#f48fb1", wordBreak: "break-word" as const } }, errorMessage)
          ),
          React.createElement(
            "div",
            { style: { display: "flex", gap: "10px", justifyContent: "center" } },
            React.createElement("button", { onClick: closeModal, style: btnSecondary }, "Close"),
            React.createElement("button", { onClick: executeRemove, style: btnPrimary }, "Retry")
          )
        )
    )
  );
}

export function openRemoveFromLibraryModal(context: GameContext): void {
  let modalHandle: any;
  modalHandle = showModal(
    React.createElement(RemoveFromLibraryModalContent, {
      context,
      closeModal: () => modalHandle?.Close?.(),
    }),
    undefined,
    { strTitle: "Remove from Library", popupWidth: 420, popupHeight: 360, bForcePopOut: false }
  );
}

// -------------------------------------------------------------
// 4. Settings Modal
// -------------------------------------------------------------
function SettingsModalContent({ closeModal }: { closeModal: () => void }) {
  const [apiKey, setApiKey] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [placeholder, setPlaceholder] = React.useState("Enter your API key");
  const [result, setResult] = React.useState<{ status: number; username?: string; daily_usage?: string | number; daily_limit?: string | number } | null>(null);

  React.useEffect(() => {
    async function loadSaved() {
      try {
        const data: SettingsData = await callRpc("getSettings");
        if (data && data.has_key) {
          if (data.masked_key) setPlaceholder(data.masked_key);
          if (data.username) {
            setResult({ status: 200, username: data.username, daily_usage: data.daily_usage, daily_limit: data.daily_limit });
          }

          try {
            const fresh: any = await callRpc("validateApiKey", { api_key: "" });
            if (fresh && fresh.status === 200 && fresh.username) {
              setResult({ status: 200, username: fresh.username, daily_usage: fresh.daily_usage, daily_limit: fresh.daily_limit });
            }
          } catch (apiErr) {
            console.warn("[steam-actions:settings]", "Could not refresh user details:", apiErr);
          }
        }
      } catch (err) {
        console.warn("[steam-actions:settings]", "Could not load settings:", err);
      }
    }
    loadSaved();
  }, []);

  const handleSave = async () => {
    if (!apiKey.trim()) return;
    setLoading(true);
    try {
      const res = await callRpc("validateApiKey", { api_key: apiKey.trim() });
      setResult(res);
    } catch {
      setResult({ status: 0 });
    } finally {
      setLoading(false);
    }
  };

  const usageDisplay =
    result?.daily_limit !== undefined && result?.daily_limit !== null && result?.daily_limit !== ""
      ? `${result.daily_usage ?? 0} / ${result.daily_limit}`
      : `${result?.daily_usage ?? "—"}`;

  return React.createElement(
    ModalRoot,
    { closeModal, bDisableBackgroundDismiss: false },
    React.createElement(
      "div",
      { style: { ...modalContainerStyle, textAlign: "left" as const } },
      React.createElement("div", { style: { fontSize: "18px", fontWeight: "bold", color: theme.primary, marginBottom: "20px" } }, "Settings"),
      React.createElement(
        "label",
        { style: { display: "block", fontSize: "12px", color: theme.textMuted, marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.5px" } },
        "API Key"
      ),
      React.createElement("input", {
        type: "password",
        placeholder,
        value: apiKey,
        onChange: (e: any) => setApiKey(e.target.value),
        style: { ...inputStyle, marginBottom: "16px" },
      }),
      result &&
        (result.status === 200
          ? React.createElement(
              "div",
              { style: { marginBottom: "16px", padding: "14px", background: "rgba(76, 175, 80, 0.1)", border: `1px solid ${theme.success}`, borderRadius: "3px" } },
              React.createElement("div", { style: { color: theme.success, fontWeight: "bold", marginBottom: "10px", fontSize: "13px" } }, "✓ Connected"),
              React.createElement(
                "div",
                { style: { display: "flex", justifyContent: "space-between", marginBottom: "6px" } },
                React.createElement("span", { style: { color: theme.textMuted, fontSize: "12px", textTransform: "uppercase" } }, "Username"),
                React.createElement("span", { style: { color: theme.text, fontSize: "14px" } }, result.username || "—")
              ),
              React.createElement(
                "div",
                { style: { display: "flex", justifyContent: "space-between" } },
                React.createElement("span", { style: { color: theme.textMuted, fontSize: "12px", textTransform: "uppercase" } }, "Usage"),
                React.createElement("span", { style: { color: theme.text, fontSize: "14px" } }, usageDisplay)
              )
            )
          : React.createElement(
              "div",
              { style: { marginBottom: "16px", padding: "14px", background: "rgba(244, 67, 54, 0.1)", border: `1px solid ${theme.danger}`, borderRadius: "3px" } },
              React.createElement("div", { style: { color: theme.danger, fontWeight: "bold", fontSize: "13px" } }, "✗ Invalid API Key")
            )),
      React.createElement(
        "div",
        { style: { display: "flex", gap: "10px", justifyContent: "flex-end" } },
        React.createElement("button", { onClick: closeModal, style: btnSecondary }, "Cancel"),
        React.createElement("button", { onClick: handleSave, disabled: loading, style: { ...btnPrimary, opacity: loading ? 0.6 : 1 } }, loading ? "Saving..." : "Save")
      )
    )
  );
}

export function openSettingsModal(): void {
  let modalHandle: any;
  modalHandle = showModal(
    React.createElement(SettingsModalContent, { closeModal: () => modalHandle?.Close?.() }),
    undefined,
    { strTitle: "Settings", popupWidth: 440, popupHeight: 400, bForcePopOut: false }
  );
}

// -------------------------------------------------------------
// 5. Game Status & Offline Emulator Modal
// -------------------------------------------------------------
function GameStatusModalContent({
  context,
  closeModal,
}: {
  context: GameContext;
  closeModal: () => void;
}) {
  const [loading, setLoading] = React.useState(true);
  const [status, setStatus] = React.useState<any>(null);
  const [actionLoading, setActionLoading] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<{ text: string; isError: boolean } | null>(null);

  const refreshStatus = React.useCallback(async () => {
    try {
      const data = await callRpc("getGameStatus", context.appId);
      setStatus(data);
    } catch (e: any) {
      setMessage({ text: e.message || "Failed to load status", isError: true });
    } finally {
      setLoading(false);
    }
  }, [context.appId]);

  React.useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  const handleDeploy = async () => {
    setActionLoading("deploy");
    setMessage(null);
    try {
      const res = await callRpc("deployEmulator", context.appId);
      if (res?.success) {
        setMessage({ text: "Offline crack applied successfully! Original files backed up as .bak.", isError: false });
        await refreshStatus();
      } else {
        setMessage({ text: res?.message || "Failed to apply crack.", isError: true });
      }
    } catch (e: any) {
      setMessage({ text: e.message || "Deploy error", isError: true });
    } finally {
      setActionLoading(null);
    }
  };

  const handleRestore = async () => {
    setActionLoading("restore");
    setMessage(null);
    try {
      const res = await callRpc("restoreOriginal", context.appId);
      if (res?.success) {
        setMessage({ text: "Original files restored and emulator crack removed.", isError: false });
        await refreshStatus();
      } else {
        setMessage({ text: res?.message || "Failed to restore original files.", isError: true });
      }
    } catch (e: any) {
      setMessage({ text: e.message || "Restore error", isError: true });
    } finally {
      setActionLoading(null);
    }
  };

  const handleExport = async () => {
    setActionLoading("export");
    setMessage(null);
    try {
      const res = await callRpc("exportEmulatorZip", context.appId);
      if (res?.success) {
        setMessage({ text: `Standalone crack ZIP created: ${res.zip_path || "in downloads folder"}`, isError: false });
      } else {
        setMessage({ text: res?.message || "Failed to export ZIP.", isError: true });
      }
    } catch (e: any) {
      setMessage({ text: e.message || "Export error", isError: true });
    } finally {
      setActionLoading(null);
    }
  };

  const handleDownloadToolchain = async () => {
    setActionLoading("toolchain");
    setMessage(null);
    try {
      await callRpc("downloadEmulatorToolchain");
      await refreshStatus();
    } catch (e: any) {
      setMessage({ text: "Failed to download toolchain files.", isError: true });
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return React.createElement(
      ModalRoot,
      { closeModal, bDisableBackgroundDismiss: false },
      React.createElement(
        "div",
        { style: modalContainerStyle },
        React.createElement(SpinnerIcon),
        React.createElement("div", { style: { fontSize: "16px", color: theme.primary, marginTop: "12px" } }, "Checking Game & Crack Status..."),
        React.createElement("div", { style: { fontSize: "13px", color: theme.textMuted, marginTop: "4px" } }, context.title)
      )
    );
  }

  const installed = status?.installed ?? false;
  const updatePending = status?.update_pending ?? false;
  const emu = status?.emu;
  const isCracked = emu?.is_cracked ?? false;

  return React.createElement(
    ModalRoot,
    { closeModal, bDisableBackgroundDismiss: false },
    React.createElement(
      "div",
      { style: { ...modalContainerStyle, textAlign: "left" as const, maxWidth: "480px" } },
      React.createElement("div", { style: { fontSize: "18px", fontWeight: "bold", color: theme.primary, marginBottom: "4px" } }, "Game & Emulator Status"),
      React.createElement("div", { style: { fontSize: "12px", color: theme.textMuted, marginBottom: "16px" } }, `${status?.name || context.title} (App ID: ${context.appId})`),

      // AV Alert Card
      emu && !emu.toolchain_ready &&
        React.createElement(
          "div",
          {
            style: {
              background: "rgba(255, 152, 0, 0.12)",
              border: "1px solid rgba(255, 152, 0, 0.4)",
              borderRadius: "3px",
              padding: "12px",
              marginBottom: "14px",
              fontSize: "12px",
              color: "#ffb74d",
            },
          },
          React.createElement("div", { style: { fontWeight: "bold", marginBottom: "4px" } }, "⚠ Antivirus Alert: Emulator Files Missing / Quarantined"),
          React.createElement("div", { style: { color: theme.text, marginBottom: "8px" } }, "Windows Defender routinely flags Steam emulator DLLs. Add an exclusion for the plugin data directory."),
          React.createElement(
            "button",
            {
              onClick: handleDownloadToolchain,
              disabled: actionLoading === "toolchain",
              style: { ...btnBase, padding: "5px 12px", background: "#ff9800", color: "#1b2838", fontWeight: "bold" },
            },
            actionLoading === "toolchain" ? "Downloading..." : "Re-download Emu Files"
          )
        ),

      // Steam Status Card
      React.createElement(
        "div",
        {
          style: {
            background: "rgba(255, 255, 255, 0.03)",
            border: `1px solid ${theme.border}`,
            borderRadius: "3px",
            padding: "12px",
            marginBottom: "12px",
            fontSize: "12px",
          },
        },
        React.createElement("div", { style: { display: "flex", justifyContent: "space-between", marginBottom: "4px" } },
          React.createElement("span", { style: { color: theme.textMuted } }, "Steam Installed"),
          React.createElement("span", { style: { color: installed ? theme.success : theme.danger, fontWeight: "bold" } }, installed ? "Yes" : "No")
        ),
        React.createElement("div", { style: { display: "flex", justifyContent: "space-between", marginBottom: "4px" } },
          React.createElement("span", { style: { color: theme.textMuted } }, "Steam Updates"),
          React.createElement("span", { style: { color: updatePending ? "#ffc107" : theme.success, fontWeight: "bold" } }, updatePending ? "Update Pending" : "Up to Date")
        ),
        status?.buildid && React.createElement("div", { style: { display: "flex", justifyContent: "space-between", marginBottom: "4px" } },
          React.createElement("span", { style: { color: theme.textMuted } }, "Build ID"),
          React.createElement("span", { style: { color: theme.text } }, String(status.buildid))
        ),
        status?.target_buildid && React.createElement("div", { style: { display: "flex", justifyContent: "space-between", marginBottom: "4px" } },
          React.createElement("span", { style: { color: theme.textMuted } }, "Target Build ID"),
          React.createElement("span", { style: { color: "#ffc107", fontWeight: "bold" } }, String(status.target_buildid))
        ),
        updatePending && React.createElement(
          "div",
          { style: { marginTop: "8px", padding: "6px 8px", background: "rgba(255, 193, 7, 0.12)", border: "1px solid rgba(255, 193, 7, 0.3)", borderRadius: "2px", color: "#ffc107", fontSize: "11px" } },
          "⚠ Steam has an update pending. Cracking now risks being wiped when Steam updates."
        ),
        !installed && React.createElement(
          "div",
          { style: { marginTop: "8px", padding: "6px 8px", background: "rgba(244, 67, 54, 0.1)", border: `1px solid rgba(244, 67, 54, 0.3)`, borderRadius: "2px", color: "#f48fb1", fontSize: "11px" } },
          "Game files are not on disk. Install via Steam before applying the emulator crack."
        )
      ),

      // Emulator Status Card
      installed && React.createElement(
        "div",
        {
          style: {
            background: "rgba(255, 255, 255, 0.03)",
            border: `1px solid ${theme.border}`,
            borderRadius: "3px",
            padding: "12px",
            marginBottom: "16px",
            fontSize: "12px",
          },
        },
        React.createElement("div", { style: { display: "flex", justifyContent: "space-between", marginBottom: "4px" } },
          React.createElement("span", { style: { color: theme.textMuted } }, "Offline Crack"),
          React.createElement("span", { style: { color: isCracked ? theme.success : theme.textMuted, fontWeight: "bold" } }, isCracked ? "Cracked (ColdLoader + gbe)" : "Genuine Steam")
        ),
        React.createElement("div", { style: { display: "flex", justifyContent: "space-between", marginBottom: "4px" } },
          React.createElement("span", { style: { color: theme.textMuted } }, "Target Binary"),
          React.createElement("span", { style: { color: theme.text } }, emu?.exe_name ? `${emu.exe_name} (${emu.arch || "x64"})` : "Not Found")
        ),
        React.createElement("div", { style: { display: "flex", justifyContent: "space-between", marginBottom: "4px" } },
          React.createElement("span", { style: { color: theme.textMuted } }, "Original steam_api"),
          React.createElement("span", { style: { color: emu?.has_backup ? theme.success : (emu?.steam_api_exists ? theme.text : theme.danger) } },
            emu?.has_backup ? "Backed up (.bak)" : (emu?.steam_api_exists ? "Present" : "Missing")
          )
        ),
        emu?.needs_recrack && React.createElement(
          "div",
          { style: { marginTop: "8px", padding: "6px 8px", background: "rgba(33, 150, 243, 0.12)", border: "1px solid rgba(33, 150, 243, 0.3)", borderRadius: "2px", color: "#64b5f6", fontSize: "11px" } },
          "Steam updated this game recently. Re-apply crack to update interface bindings."
        )
      ),

      // Status/Error Message
      message && React.createElement(
        "div",
        { style: { fontSize: "12px", color: message.isError ? theme.danger : theme.success, marginBottom: "12px" } },
        message.text
      ),

      // Buttons
      React.createElement(
        "div",
        { style: { display: "flex", gap: "8px", justifyContent: "flex-end", flexWrap: "wrap" as const } },
        installed && React.createElement(
          "button",
          {
            onClick: handleDeploy,
            disabled: actionLoading !== null,
            style: { ...btnBase, background: theme.success, color: "#ffffff", fontWeight: "bold", opacity: actionLoading ? 0.6 : 1 },
          },
          actionLoading === "deploy" ? "Applying..." : (isCracked ? "Re-apply Crack" : "Apply Offline Crack")
        ),
        installed && (isCracked || emu?.has_backup) && React.createElement(
          "button",
          {
            onClick: handleRestore,
            disabled: actionLoading !== null,
            style: { ...btnDanger, opacity: actionLoading ? 0.6 : 1 },
          },
          actionLoading === "restore" ? "Restoring..." : "Restore Original"
        ),
        installed && React.createElement(
          "button",
          {
            onClick: handleExport,
            disabled: actionLoading !== null,
            style: { ...btnSecondary, color: theme.primary, opacity: actionLoading ? 0.6 : 1 },
          },
          actionLoading === "export" ? "Exporting..." : "Export ZIP"
        ),
        React.createElement("button", { onClick: closeModal, style: btnSecondary }, "Close")
      )
    )
  );
}

export function openGameStatusModal(context: GameContext): void {
  let modalHandle: any;
  modalHandle = showModal(
    React.createElement(GameStatusModalContent, {
      context,
      closeModal: () => modalHandle?.Close?.(),
    }),
    undefined,
    { strTitle: "Game Status", popupWidth: 480, popupHeight: 460, bForcePopOut: false }
  );
}

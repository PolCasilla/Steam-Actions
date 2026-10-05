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
    { strTitle: "Game Actions", popupWidth: 400, popupHeight: 280, bForcePopOut: false }
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

          // Live API call for user details if key is saved
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

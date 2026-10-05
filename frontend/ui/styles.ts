export const theme = {
  bg: "#1b2838",
  cardBg: "#2a475e",
  border: "#4c6b88",
  text: "#d6d7d8",
  textMuted: "#8f98a0",
  primary: "#67c1f5",
  success: "#4caf50",
  danger: "#f44336",
  font: "'Motiva Sans', Arial, sans-serif",
};

export const modalContainerStyle = {
  padding: "24px",
  minWidth: "340px",
  maxWidth: "420px",
  background: theme.bg,
  color: theme.text,
  fontFamily: theme.font,
  textAlign: "center" as const,
};

export const btnBase = {
  padding: "8px 20px",
  border: "none",
  borderRadius: "3px",
  fontSize: "13px",
  fontFamily: "inherit",
  cursor: "pointer",
};

export const btnPrimary = {
  ...btnBase,
  background: theme.primary,
  color: theme.bg,
  fontWeight: "bold",
};

export const btnSecondary = {
  ...btnBase,
  background: theme.cardBg,
  color: theme.text,
};

export const btnDanger = {
  ...btnBase,
  background: "#e53935",
  color: "#ffffff",
  fontWeight: "bold",
};

export const inputStyle = {
  width: "100%",
  padding: "10px 12px",
  background: theme.cardBg,
  border: `1px solid ${theme.border}`,
  borderRadius: "3px",
  color: theme.text,
  fontSize: "14px",
  fontFamily: "inherit",
  outline: "none",
  boxSizing: "border-box" as const,
};

export const statusCardBase = {
  borderRadius: "3px",
  padding: "14px",
  marginBottom: "20px",
  textAlign: "left" as const,
};

export const statusCardSuccess = {
  ...statusCardBase,
  background: "rgba(76, 175, 80, 0.08)",
  border: "1px solid rgba(76, 175, 80, 0.3)",
};

export const statusCardDanger = {
  ...statusCardBase,
  background: "rgba(244, 67, 54, 0.08)",
  border: "1px solid rgba(244, 67, 54, 0.3)",
};


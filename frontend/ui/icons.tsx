import { theme } from "./styles";

const React = (globalThis as any).SP_REACT;

export function SpinnerIcon() {
  return React.createElement("div", {
    style: { margin: "8px auto 20px auto", width: "44px", height: "44px" },
    dangerouslySetInnerHTML: {
      __html: `
        <svg width="44" height="44" viewBox="0 0 40 40" stroke="${theme.primary}">
          <g fill="none" fill-rule="evenodd">
            <g transform="translate(2 2)" stroke-width="3">
              <circle stroke-opacity=".2" cx="18" cy="18" r="18" stroke="${theme.primary}"/>
              <path d="M36 18c0-9.94-8.06-18-18-18">
                <animateTransform attributeName="transform" type="rotate" from="0 18 18" to="360 18 18" dur="0.8s" repeatCount="indefinite"/>
              </path>
            </g>
          </g>
        </svg>
      `,
    },
  });
}

export function SuccessIcon() {
  return React.createElement("div", {
    style: { margin: "4px auto 16px auto", width: "52px", height: "52px" },
    dangerouslySetInnerHTML: {
      __html: `
        <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="${theme.success}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10" stroke="${theme.success}" fill="rgba(76, 175, 80, 0.15)"></circle>
          <polyline points="7 13 10 16 17 9"></polyline>
        </svg>
      `,
    },
  });
}

export function ErrorIcon() {
  return React.createElement("div", {
    style: { margin: "4px auto 16px auto", width: "52px", height: "52px" },
    dangerouslySetInnerHTML: {
      __html: `
        <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="${theme.danger}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10" stroke="${theme.danger}" fill="rgba(244, 67, 54, 0.15)"></circle>
          <line x1="15" y1="9" x2="9" y2="15"></line>
          <line x1="9" y1="9" x2="15" y2="15"></line>
        </svg>
      `,
    },
  });
}

export function WarningIcon() {
  return React.createElement("div", {
    style: { margin: "4px auto 16px auto", width: "48px", height: "48px" },
    dangerouslySetInnerHTML: {
      __html: `
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="${theme.danger}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
          <line x1="12" y1="9" x2="12" y2="13"></line>
          <line x1="12" y1="17" x2="12.01" y2="17"></line>
        </svg>
      `,
    },
  });
}

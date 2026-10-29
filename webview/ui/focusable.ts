/**
 * Ensures an interactive element works seamlessly with Steam GamepadUI spatial navigation
 * and keyboard focus in Big Picture Mode and Desktop mode.
 */
export function makeFocusable(
  el: HTMLElement,
  options?: {
    baseBg?: string;
    hoverBg?: string;
    borderColor?: string;
    focusBorderColor?: string;
    autoFocus?: boolean;
    onActivate?: () => void;
  },
): void {
  el.classList.add("Focusable");
  el.setAttribute("tabindex", "0");

  const panelData = options?.autoFocus
    ? '{"autoFocus":true,"focusable":true,"clickOnActivate":true}'
    : '{"focusable":true,"clickOnActivate":true}';
  el.setAttribute("data-panel", panelData);

  const baseBg = options?.baseBg;
  const hoverBg = options?.hoverBg;
  const focusBorder = options?.focusBorderColor || "#67c1f5";

  const setHighlight = (active: boolean): void => {
    if (baseBg && hoverBg) {
      el.style.background = active ? hoverBg : baseBg;
    }
    el.style.borderColor = active ? focusBorder : (options?.borderColor || "transparent");
    el.style.boxShadow = active ? "0 0 12px rgba(103, 193, 245, 0.6)" : "none";
  };

  el.addEventListener("mouseenter", () => setHighlight(true));
  el.addEventListener("mouseleave", () => {
    if (typeof document !== "undefined" && document.activeElement !== el) {
      setHighlight(false);
    }
  });
  el.addEventListener("focus", () => setHighlight(true));
  el.addEventListener("blur", () => setHighlight(false));

  if (options?.onActivate) {
    el.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      options.onActivate!();
    });

    el.addEventListener("keydown", (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        e.stopPropagation();
        options.onActivate!();
      }
    });
  }
}

export interface ModalTrap {
  release: () => void;
  focusFirst: () => void;
}

/**
 * Traps controller / keyboard focus inside a modal dialog and isolates it from
 * the background Steam store page:
 * 1. Registers with Steam's native GamepadUI modal manager (GPOnShowingModalWindow / GPNavFocusChild).
 * 2. Sets data-panel metadata so Gamepad spatial navigation traverses modal buttons.
 * 3. Suspends background .Focusable elements.
 * 4. Traps Tab navigation and catches any stray directional keys if focus drops to body.
 */
export function trapModalFocus(
  backdrop: HTMLElement,
  initialFocusTarget?: HTMLElement | null,
  onEscape?: () => void,
): ModalTrap {
  backdrop.setAttribute("data-panel", '{"flow-children":"column","autoFocus":true}');

  const win = typeof window !== "undefined" ? (window as any) : null;
  let gpCloseModal: (() => void) | null = null;
  if (win && typeof win.GPOnShowingModalWindow === "function") {
    try {
      gpCloseModal = win.GPOnShowingModalWindow(backdrop);
    } catch (e) {
      console.warn("[steam-actions:modal] GPOnShowingModalWindow failed:", e);
    }
  }

  const suspendedElements: HTMLElement[] = [];
  if (typeof document !== "undefined") {
    const allFocusables = Array.from(document.querySelectorAll<HTMLElement>(".Focusable"));
    for (const el of allFocusables) {
      if (!backdrop.contains(el)) {
        el.classList.remove("Focusable");
        el.classList.add("Focusable-Suspended");
        suspendedElements.push(el);
      }
    }
  }

  const focusTarget = (): void => {
    const target =
      initialFocusTarget ||
      backdrop.querySelector<HTMLElement>("[data-panel*='autoFocus']") ||
      backdrop.querySelector<HTMLElement>(".Focusable:not([disabled])") ||
      backdrop.querySelector<HTMLElement>("button, input, [tabindex='0']");

    if (target && typeof target.focus === "function") {
      target.focus();
    }
    if (win && typeof win.GPNavFocusChild === "function" && target) {
      try {
        win.GPNavFocusChild(target);
      } catch (e) {
        console.warn("[steam-actions:modal] GPNavFocusChild failed:", e);
      }
    }
  };

  focusTarget();
  if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
    window.requestAnimationFrame(focusTarget);
  }

  const keyHandler = (e: KeyboardEvent): void => {
    if (e.key === "Escape") {
      if (onEscape) {
        e.preventDefault();
        e.stopPropagation();
        onEscape();
      }
      return;
    }

    const modalFocusables = Array.from(
      backdrop.querySelectorAll<HTMLElement>(".Focusable:not([disabled]), [data-panel*='focusable']:not([disabled])"),
    );
    if (modalFocusables.length === 0) return;

    if (e.key === "Tab") {
      const active = (typeof document !== "undefined" ? document.activeElement : null) as HTMLElement | null;
      const idx = active ? modalFocusables.indexOf(active) : -1;
      e.preventDefault();
      if (e.shiftKey) {
        const prev = idx > 0 ? idx - 1 : modalFocusables.length - 1;
        modalFocusables[prev]?.focus();
      } else {
        const next = idx >= 0 && idx < modalFocusables.length - 1 ? idx + 1 : 0;
        modalFocusables[next]?.focus();
      }
      return;
    }

    if (
      e.key === "ArrowDown" ||
      e.key === "ArrowUp" ||
      e.key === "ArrowLeft" ||
      e.key === "ArrowRight" ||
      e.key === "Down" ||
      e.key === "Up" ||
      e.key === "Left" ||
      e.key === "Right"
    ) {
      const active = typeof document !== "undefined" ? document.activeElement : null;
      if (!active || !backdrop.contains(active)) {
        e.preventDefault();
        focusTarget();
      }
    }
  };

  if (typeof window !== "undefined") {
    window.addEventListener("keydown", keyHandler, true);
  }

  let released = false;
  const release = (): void => {
    if (released) return;
    released = true;

    if (typeof window !== "undefined") {
      window.removeEventListener("keydown", keyHandler, true);
    }

    if (typeof gpCloseModal === "function") {
      try {
        gpCloseModal();
      } catch (e) {
        console.warn("[steam-actions:modal] gpCloseModal failed:", e);
      }
      gpCloseModal = null;
    }

    for (const el of suspendedElements) {
      el.classList.remove("Focusable-Suspended");
      el.classList.add("Focusable");
    }
  };

  return {
    release,
    focusFirst: focusTarget,
  };
}

export function refocusActionTarget(): void {
  if (typeof document === "undefined") return;
  const target = document.querySelector<HTMLElement>(
    "#steam-actions-button button, #steam-actions-button .btnv6_blue_hoverfade, #steam-actions-button, .steam-actions-floating-button, .queue_actions_ctn",
  );
  if (target && typeof target.focus === "function") {
    target.focus();
    const win = typeof window !== "undefined" ? (window as any) : null;
    if (win && typeof win.GPNavFocusChild === "function") {
      try {
        win.GPNavFocusChild(target);
      } catch {}
    }
  }
}

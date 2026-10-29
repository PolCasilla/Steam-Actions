import { describe, it, expect, beforeEach } from "bun:test";
import { trapModalFocus, refocusActionTarget } from "../webview/ui/focusable";
import { SettingsOverlay } from "../webview/ui/settings-overlay";

class MockElement {
  id: string = "";
  tagName: string = "DIV";
  type: string = "";
  value: string = "";
  placeholder: string = "";
  private _className: string = "";
  get className() { return this._className; }
  set className(val: string) {
    this._className = val;
    this.classList._classes = new Set(val.split(" ").filter(Boolean));
  }

  classList = {
    _classes: new Set<string>(),
    add: (...cls: string[]) => cls.forEach((c) => this.classList._classes.add(c)),
    remove: (...cls: string[]) => cls.forEach((c) => this.classList._classes.delete(c)),
    contains: (c: string) => this.classList._classes.has(c),
  };
  attributes: Record<string, string> = {};
  style: Record<string, string> = { cssText: "" };
  children: MockElement[] = [];
  parentElement: MockElement | null = null;
  textContent: string = "";
  listeners: Record<string, Function[]> = {};

  setAttribute(k: string, v: string) { this.attributes[k] = v; }
  getAttribute(k: string) { return this.attributes[k]; }
  hasAttribute(k: string) { return k in this.attributes; }
  removeAttribute(k: string) { delete this.attributes[k]; }
  appendChild(child: MockElement) {
    child.parentElement = this;
    this.children.push(child);
  }
  replaceChildren(...children: MockElement[]) {
    this.children = [];
    children.forEach((c) => this.appendChild(c));
    if (children.length === 0) this.textContent = "";
  }
  addEventListener(event: string, fn: Function) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(fn);
  }
  removeEventListener(event: string, fn: Function) {
    if (this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter((f) => f !== fn);
    }
  }
  dispatchEvent(event: { type: string; preventDefault?: Function; stopPropagation?: Function; key?: string }) {
    event.preventDefault = event.preventDefault || (() => {});
    event.stopPropagation = event.stopPropagation || (() => {});
    (this.listeners[event.type] || []).forEach((fn) => fn(event));
  }
  remove() {
    if (this.parentElement) {
      this.parentElement.children = this.parentElement.children.filter((c) => c !== this);
      this.parentElement = null;
    }
  }
  focus() {
    (globalThis as any).document.activeElement = this;
    this.dispatchEvent({ type: "focus" });
  }
  blur() {
    if ((globalThis as any).document.activeElement === this) {
      (globalThis as any).document.activeElement = null;
    }
    this.dispatchEvent({ type: "blur" });
  }
  contains(target: MockElement): boolean {
    if (this === target) return true;
    for (const child of this.children) {
      if (child.contains(target)) return true;
    }
    return false;
  }
  matches(selector: string) {
    return selector.split(",").some((part) => {
      const s = part.trim();
      if (s.startsWith(".")) return this.classList.contains(s.slice(1));
      if (s.startsWith("#")) return this.id === s.slice(1);
      return this.tagName.toLowerCase() === s.toLowerCase();
    });
  }
  querySelector(selector: string): MockElement | null {
    for (const child of this.children) {
      if (child.matches(selector) || child.id === selector.replace("#", "")) return child;
      const found = child.querySelector(selector);
      if (found) return found;
    }
    return null;
  }
  querySelectorAll(selector: string): MockElement[] {
    const results: MockElement[] = [];
    const search = (el: MockElement) => {
      for (const child of el.children) {
        if (child.matches(selector) || child.id === selector.replace("#", "")) results.push(child);
        search(child);
      }
    };
    search(this);
    return results;
  }
}

describe("Modal focus trapping and isolation", () => {
  let doc: { body: MockElement; activeElement: MockElement | null; getElementById: Function; querySelector: Function; querySelectorAll: Function; createElement: Function };
  let windowListeners: Record<string, Function[]> = {};

  beforeEach(() => {
    windowListeners = {};
    const body = new MockElement();
    doc = {
      body,
      activeElement: null,
      getElementById: (id: string) => {
        const find = (el: MockElement): MockElement | null => {
          if (el.id === id) return el;
          for (const c of el.children) {
            const f = find(c);
            if (f) return f;
          }
          return null;
        };
        return find(body);
      },
      querySelector: (sel: string) => body.querySelector(sel),
      querySelectorAll: (sel: string) => body.querySelectorAll(sel),
      createElement: (tag: string) => {
        const el = new MockElement();
        el.tagName = tag.toUpperCase();
        return el;
      },
    };
    (globalThis as any).document = doc;
    (globalThis as any).window = {
      addEventListener: (evt: string, fn: Function) => {
        if (!windowListeners[evt]) windowListeners[evt] = [];
        windowListeners[evt].push(fn);
      },
      removeEventListener: (evt: string, fn: Function) => {
        if (windowListeners[evt]) {
          windowListeners[evt] = windowListeners[evt].filter((f) => f !== fn);
        }
      },
      requestAnimationFrame: (cb: Function) => cb(),
    };
  });

  it("suspends background Focusable elements and marks modal with data-panel", () => {
    let gpModalShown = false;
    let gpFocusedEl: any = null;
    (globalThis as any).window.GPOnShowingModalWindow = (el: any) => {
      gpModalShown = true;
      return () => { gpModalShown = false; };
    };
    (globalThis as any).window.GPNavFocusChild = (el: any) => {
      gpFocusedEl = el;
    };

    // Background store container with Focusable buttons
    const storeContainer = new MockElement();
    const storeBtn1 = new MockElement();
    storeBtn1.className = "store-btn Focusable";
    const storeBtn2 = new MockElement();
    storeBtn2.className = "store-btn Focusable";
    storeContainer.appendChild(storeBtn1);
    storeContainer.appendChild(storeBtn2);
    doc.body.appendChild(storeContainer);

    // Modal backdrop with internal Focusable button
    const backdrop = new MockElement();
    const modalBtn = new MockElement();
    modalBtn.className = "modal-btn Focusable";
    backdrop.appendChild(modalBtn);
    doc.body.appendChild(backdrop);

    const trap = trapModalFocus(backdrop as any, modalBtn as any);

    // Background elements should be suspended
    expect(storeBtn1.classList.contains("Focusable")).toBe(false);
    expect(storeBtn1.classList.contains("Focusable-Suspended")).toBe(true);
    expect(storeBtn2.classList.contains("Focusable")).toBe(false);
    expect(storeBtn2.classList.contains("Focusable-Suspended")).toBe(true);

    // Backdrop must have data-panel attribute for GamepadUI
    expect(backdrop.getAttribute("data-panel")).toContain("autoFocus");
    expect(backdrop.getAttribute("data-panel")).toContain("flow-children");

    // Modal button should have active focus and be notified to GamepadUI
    expect(doc.activeElement).toBe(modalBtn);
    expect(gpModalShown).toBe(true);
    expect(gpFocusedEl).toBe(modalBtn);

    // Release trap
    trap.release();

    // Background elements should be restored and modal cleaned up
    expect(storeBtn1.classList.contains("Focusable")).toBe(true);
    expect(storeBtn1.classList.contains("Focusable-Suspended")).toBe(false);
    expect(gpModalShown).toBe(false);
  });

  it("SettingsOverlay mounts synchronously and locks focus inside dialog", () => {
    // Add floating action button to store
    const floatingBtn = new MockElement();
    floatingBtn.className = "steam-actions-floating-button Focusable";
    doc.body.appendChild(floatingBtn);

    const overlay = new SettingsOverlay();
    overlay.open();

    const backdrop = doc.getElementById("steam-actions-settings-overlay");
    expect(backdrop).not.toBeNull();

    // Floating button on store should be suspended
    expect(floatingBtn.classList.contains("Focusable")).toBe(false);
    expect(floatingBtn.classList.contains("Focusable-Suspended")).toBe(true);

    // Active element must be Cancel button inside dialog
    expect(doc.activeElement).not.toBeNull();
    expect(doc.activeElement?.textContent).toBe("Cancel");

    const cancelBtn = doc.activeElement as MockElement;
    const input = backdrop.querySelector("input") as MockElement;
    const saveBtn = backdrop.querySelectorAll("button")[1] as MockElement;

    // ArrowRight from Cancel moves to Save
    cancelBtn.dispatchEvent({ type: "keydown", key: "ArrowRight" });
    expect(doc.activeElement).toBe(saveBtn);

    // ArrowLeft from Save moves back to Cancel
    saveBtn.dispatchEvent({ type: "keydown", key: "ArrowLeft" });
    expect(doc.activeElement).toBe(cancelBtn);

    // ArrowUp from Cancel moves to Input
    cancelBtn.dispatchEvent({ type: "keydown", key: "ArrowUp" });
    expect(doc.activeElement).toBe(input);

    // ArrowDown from Input moves to Cancel
    input.dispatchEvent({ type: "keydown", key: "ArrowDown" });
    expect(doc.activeElement).toBe(cancelBtn);

    // Close overlay
    overlay.close();

    // Overlay removed
    expect(doc.getElementById("steam-actions-settings-overlay")).toBeNull();

    // Floating button should have Focusable restored and active focus
    expect(floatingBtn.classList.contains("Focusable")).toBe(true);
    expect(doc.activeElement).toBe(floatingBtn);
  });
});

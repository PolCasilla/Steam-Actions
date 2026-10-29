import { describe, it, expect, beforeEach } from "bun:test";
import { NativeActionButton } from "../webview/ui/native-action-button";

// Lightweight DOM setup for headless testing
class MockElement {
  id: string = "";
  tagName: string = "DIV";
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

  get isConnected(): boolean {
    return !!this.parentElement;
  }

  boundingRect = { top: 760, bottom: 792, left: 100, right: 180, width: 80, height: 32 };
  getBoundingClientRect() {
    return this.boundingRect;
  }

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
    if (!this.listeners[event]) return;
    this.listeners[event] = this.listeners[event].filter((f) => f !== fn);
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
  matches(selector: string) {
    return selector.split(",").some((s) => {
      const part = s.trim();
      if (part.startsWith(".")) return this.classList.contains(part.slice(1));
      if (part.startsWith("#")) return this.id === part.slice(1);
      if (part.toLowerCase() === this.tagName.toLowerCase()) return true;
      return this.classList.contains(part);
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
  closest(selector: string): MockElement | null {
    let curr: MockElement | null = this;
    while (curr) {
      if (curr.matches(selector)) return curr;
      curr = curr.parentElement;
    }
    return null;
  }
  cloneNode(deep: boolean = false): MockElement {
    const clone = new MockElement();
    clone.id = this.id;
    clone.className = this.className;
    clone.textContent = this.textContent;
    return clone;
  }
  insertAdjacentElement(position: string, element: MockElement) {
    if (position === "afterend" && this.parentElement) {
      const idx = this.parentElement.children.indexOf(this);
      this.parentElement.children.splice(idx + 1, 0, element);
      element.parentElement = this.parentElement;
    } else if (position === "beforebegin" && this.parentElement) {
      const idx = this.parentElement.children.indexOf(this);
      this.parentElement.children.splice(idx, 0, element);
      element.parentElement = this.parentElement;
    }
  }
  before(element: MockElement) {
    this.insertAdjacentElement("beforebegin", element);
  }
  after(element: MockElement) {
    this.insertAdjacentElement("afterend", element);
  }
}

describe("NativeActionButton in Big Picture Mode", () => {
  let doc: { body: MockElement; documentElement: MockElement; cookie: string; readyState: string; getElementById: Function; querySelector: Function; querySelectorAll: Function; createElement: Function; createElementNS: Function };

  beforeEach(() => {
    const body = new MockElement();
    const docEl = new MockElement();
    doc = {
      body,
      documentElement: docEl,
      cookie: "",
      readyState: "complete",
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
      createElementNS: (ns: string, tag: string) => new MockElement(),
    };
    (globalThis as any).document = doc;
    (globalThis as any).window = { innerWidth: 1280, innerHeight: 800 };
    (globalThis as any).navigator = { userAgent: "Mozilla/5.0 Valve Steam Gamepad/1.0" };
  });

  it("injects Actions button fixed at the bottom right in BPM", () => {
    const selectBtn = new MockElement();
    selectBtn.tagName = "BUTTON";
    selectBtn.textContent = "Select";
    selectBtn.boundingRect = { top: 760, bottom: 792, left: 100, right: 180, width: 80, height: 32 };
    doc.body.appendChild(selectBtn);

    let activated = false;
    const buttonManager = new NativeActionButton();
    buttonManager.ensure({
      label: "Actions",
      onActivate: () => {
        activated = true;
      },
    });

    const actionsBtn = doc.getElementById("steam-actions-button");
    expect(actionsBtn).not.toBeNull();
    expect(actionsBtn?.classList.contains("steam-actions-bpm-bottom-button")).toBe(true);
    expect(actionsBtn?.classList.contains("Focusable")).toBe(true);
    expect(actionsBtn?.getAttribute("tabindex")).toBe("0");

    // Docked fixed at bottom right
    expect(actionsBtn?.style.cssText.includes("position: fixed")).toBe(true);
    expect(actionsBtn?.style.cssText.includes("bottom: 10px")).toBe(true);
    expect(actionsBtn?.style.cssText.includes("right: 24px")).toBe(true);
    expect(doc.body.children.includes(actionsBtn!)).toBe(true);

    // Verify activation
    actionsBtn?.dispatchEvent({ type: "click" });
    expect(activated).toBe(true);

    // Directional navigation bridge verification
    (globalThis as any).document.activeElement = null;
    selectBtn.focus = () => { (globalThis as any).document.activeElement = selectBtn; };
    if (actionsBtn) {
      actionsBtn.focus = () => { (globalThis as any).document.activeElement = actionsBtn; };
    }

    // ArrowRight on adjacent bottom button moves focus to Actions
    selectBtn.dispatchEvent({ type: "keydown", key: "ArrowRight" });
    expect((globalThis as any).document.activeElement).toBe(actionsBtn);

    // ArrowLeft on Actions moves focus back to adjacent bottom button
    actionsBtn?.dispatchEvent({ type: "keydown", key: "ArrowLeft" });
    expect((globalThis as any).document.activeElement).toBe(selectBtn);
  });

  it("injects fixed bottom button at the rightmost in BPM when no other buttons exist", () => {
    let activated = false;
    const buttonManager = new NativeActionButton();
    buttonManager.ensure({
      label: "Actions",
      onActivate: () => {
        activated = true;
      },
    });

    const actionsBtn = doc.getElementById("steam-actions-button");
    expect(actionsBtn).not.toBeNull();
    expect(actionsBtn?.classList.contains("steam-actions-bpm-bottom-button")).toBe(true);
    expect(doc.body.children.includes(actionsBtn!)).toBe(true);
    expect(actionsBtn?.style.cssText.includes("right: 24px")).toBe(true);
    expect(actionsBtn?.style.cssText.includes("position: fixed")).toBe(true);

    // Verify activation via gamepad event
    actionsBtn?.dispatchEvent({ type: "vgp_buttondown", detail: { button: 0 } });
    expect(activated).toBe(true);
  });

  it("injects inline desktop control when desktop actions host exists in desktop mode", () => {
    (globalThis as any).navigator = { userAgent: "Mozilla/5.0 Valve Steam Client Desktop" };
    doc.cookie = "";

    const host = new MockElement();
    host.className = "queue_actions_ctn";
    const nativeControl = new MockElement();
    nativeControl.className = "queue_control_button queue_btn_follow";
    host.appendChild(nativeControl);
    doc.body.appendChild(host);

    const buttonManager = new NativeActionButton();
    buttonManager.ensure({
      label: "Actions",
      onActivate: () => {},
    });

    const button = doc.getElementById("steam-actions-button");
    expect(button).not.toBeNull();
    expect(button?.classList.contains("steam-actions-control")).toBe(true);
  });
});

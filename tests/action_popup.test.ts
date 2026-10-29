import { describe, it, expect, beforeEach } from "bun:test";
import { ActionPopup } from "../webview/ui/action-popup";
import type { ActionItem, GameContext } from "../webview/domain/action-item";

class MockElement {
  id: string = "";
  tagName: string = "DIV";
  type: string = "";
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
  matches(selector: string) {
    return selector.split(",").some((s) => this.classList.contains(s.trim().replace(".", "")));
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
  getBoundingClientRect() {
    return { top: 100, bottom: 138, left: 100, right: 200, width: 100, height: 38 };
  }
}

describe("ActionPopup keyboard/gamepad navigation", () => {
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
      scrollX: 0,
      scrollY: 0,
      innerWidth: 1280,
      innerHeight: 800,
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
      getComputedStyle: () => ({ position: "static" }),
    };
  });

  it("navigates items with ArrowDown and ArrowUp and activates on Enter", () => {
    const popup = new ActionPopup();
    const anchor = new MockElement();
    const context: GameContext = { appId: "10", title: "Counter-Strike", url: "https://store.steampowered.com/app/10/" };
    let selectedAction = "";
    const actions: ActionItem[] = [
      { id: "action-1", label: "Action 1", onExecute: () => { selectedAction = "action-1"; } },
      { id: "action-2", label: "Action 2", onExecute: () => { selectedAction = "action-2"; } },
    ];

    popup.open(context, actions, anchor as any);

    const menuEl = doc.getElementById("steam-actions-popup");
    const items = menuEl.querySelectorAll(".steam-actions-menu-item");

    // Initially focused on first item
    expect(doc.activeElement).toBe(items[0]);

    // Press ArrowDown -> moves to item 1
    const keydownHandlers = windowListeners["keydown"] || [];
    keydownHandlers.forEach((fn) => fn({ key: "ArrowDown", preventDefault: () => {}, stopPropagation: () => {} }));
    expect(doc.activeElement).toBe(items[1]);

    // Press ArrowDown -> moves to Close (item 2)
    keydownHandlers.forEach((fn) => fn({ key: "ArrowDown", preventDefault: () => {}, stopPropagation: () => {} }));
    expect(doc.activeElement).toBe(items[2]);

    // Press ArrowDown -> wraps to item 0
    keydownHandlers.forEach((fn) => fn({ key: "ArrowDown", preventDefault: () => {}, stopPropagation: () => {} }));
    expect(doc.activeElement).toBe(items[0]);

    // Press ArrowUp -> wraps to item 2
    keydownHandlers.forEach((fn) => fn({ key: "ArrowUp", preventDefault: () => {}, stopPropagation: () => {} }));
    expect(doc.activeElement).toBe(items[2]);

    // Press ArrowUp -> moves to item 1
    keydownHandlers.forEach((fn) => fn({ key: "ArrowUp", preventDefault: () => {}, stopPropagation: () => {} }));
    expect(doc.activeElement).toBe(items[1]);

    // Press Enter on item 1
    items[1].dispatchEvent({ type: "keydown", key: "Enter" });
    expect(selectedAction).toBe("action-2");
    expect(doc.getElementById("steam-actions-popup")).toBeNull();
  });
});

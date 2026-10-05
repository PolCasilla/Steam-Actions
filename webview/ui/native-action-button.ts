const BUTTON_ID = "steam-actions-button";
const ACTION_HOST_SELECTOR = ".queue_actions_ctn";
const NATIVE_CONTROL_SELECTOR =
  ".queue_btn_ignore, .queue_btn_follow, #add_to_wishlist_area, .queue_control_button:not(.right)";
const NATIVE_BUTTON_SELECTOR = ".queue_btn_inactive, .btnv6_blue_hoverfade, .btnv6_lightblue_blue";

export interface NativeActionButtonOptions {
  readonly label: string;
  readonly onActivate: (buttonElement: HTMLElement) => void;
}

/**
 * Creates and injects an Actions button matching native Steam Store action styling.
 */
export class NativeActionButton {
  public ensure(options: NativeActionButtonOptions): void {
    if (document.getElementById(BUTTON_ID)) {
      return;
    }

    const host = document.querySelector(ACTION_HOST_SELECTOR);
    if (!host) {
      return;
    }

    const nativeControl = host.querySelector(NATIVE_CONTROL_SELECTOR);
    if (!nativeControl) {
      return;
    }

    const control = this.createControl(nativeControl, options);
    nativeControl.insertAdjacentElement("afterend", control);
  }

  public remove(): void {
    document.getElementById(BUTTON_ID)?.remove();
  }

  private createControl(nativeControl: Element, options: NativeActionButtonOptions): HTMLElement {
    const wrapper = document.createElement("div");
    if (nativeControl.classList.contains("queue_control_button")) {
      wrapper.className = nativeControl.className;
    }
    wrapper.id = BUTTON_ID;
    wrapper.classList.remove("queue_btn_follow", "queue_btn_ignore", "queue_btn_inactive", "queue_btn_active", "right");
    wrapper.classList.add("queue_control_button", "steam-actions-control");

    const nativeButton = nativeControl.matches(NATIVE_BUTTON_SELECTOR)
      ? nativeControl
      : nativeControl.querySelector(NATIVE_BUTTON_SELECTOR);

    const button = nativeButton ? (nativeButton.cloneNode(false) as HTMLElement) : document.createElement("div");
    button.classList.remove("queue_btn_inactive", "queue_btn_active");
    button.removeAttribute("id");
    button.classList.add("btnv6_blue_hoverfade", "btn_medium");

    const labelSpan = document.createElement("span");
    labelSpan.textContent = options.label;
    button.replaceChildren(labelSpan);

    const activate = (event: Event): void => {
      event.preventDefault();
      event.stopPropagation();
      options.onActivate(button);
    };

    button.addEventListener("click", activate);
    button.addEventListener("keydown", (event: KeyboardEvent) => {
      if (event.key === "Enter" || event.key === " ") {
        activate(event);
      }
    });

    wrapper.appendChild(button);
    return wrapper;
  }
}

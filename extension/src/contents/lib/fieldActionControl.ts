import { safeSendMessage } from "../../lib/extensionContext";
import { getFieldContext } from "./fieldContext";
import {
  bindMenuReposition,
  getMenuPortalRoot,
  mountFieldTrigger,
  positionFloatingMenu,
  registerFieldOverlay,
} from "./fieldMenuPortal";
import { createGeneratorPanel, generateDefaultPassword } from "./generatorPanel";
import { fillGeneratedPassword } from "./passwordGeneratorFill";
import { createThemedShadowHost } from "./themedShadowHost";

const LOCK_ICON = `<svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true" focusable="false">
  <path fill="currentColor" d="M4 7V5a4 4 0 1 1 8 0v2h.5A1.5 1.5 0 0 1 14 8.5v5A1.5 1.5 0 0 1 12.5 15h-9A1.5 1.5 0 0 1 2 13.5v-5A1.5 1.5 0 0 1 3.5 7H4Zm1 0h6V5a3 3 0 1 0-6 0v2Z"/>
</svg>`;

export function injectFieldActionControl(
  field: HTMLInputElement,
  fieldType: "username" | "password",
): void {
  if (field.dataset.vaultlockActionControl) {
    return;
  }
  field.dataset.vaultlockActionControl = "true";

  const context = getFieldContext(field, fieldType);
  const { host, root } = createThemedShadowHost();
  host.setAttribute("data-vaultlock-trigger", "true");

  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "vl-trigger";
  trigger.innerHTML = LOCK_ICON;
  trigger.title = "VaultLock";
  trigger.setAttribute("aria-label", "VaultLock actions");
  trigger.setAttribute("aria-haspopup", "menu");
  trigger.setAttribute("aria-expanded", "false");

  const menu = document.createElement("div");
  menu.className = "vl-menu";
  menu.hidden = true;
  menu.setAttribute("role", "menu");

  const header = document.createElement("p");
  header.className = "vl-menu-title";
  header.textContent = "VaultLock";

  const actions = document.createElement("div");
  actions.className = "vl-menu-actions";

  let customizeAction: HTMLButtonElement | null = null;
  let generatorPanel: ReturnType<typeof createGeneratorPanel> | null = null;
  let generatorHost: HTMLElement | null = null;

  if (context.fieldType === "password" && context.isNewPassword) {
    const quickGenerate = createMenuAction(
      "Generate password",
      "Create a strong password for this field",
      () => {
        fillGeneratedPassword(field, generateDefaultPassword());
        closeMenu();
      },
    );

    customizeAction = createMenuAction(
      "Customize generator",
      "Adjust length and character sets",
      () => {
        if (!generatorPanel || !generatorHost || !customizeAction) {
          return;
        }

        const expanding = generatorHost.hidden;
        generatorHost.hidden = !expanding;
        customizeAction.setAttribute("aria-expanded", expanding ? "true" : "false");
        if (expanding) {
          generatorPanel.refresh();
        }
        positionFloatingMenu(menu, field);
      },
    );
    customizeAction.setAttribute("aria-expanded", "false");

    generatorPanel = createGeneratorPanel();
    generatorHost = document.createElement("div");
    generatorHost.className = "vl-menu-section";
    generatorHost.hidden = true;

    const useButton = generatorPanel.element.querySelector<HTMLButtonElement>(".vl-btn-primary");
    useButton?.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      fillGeneratedPassword(field, generatorPanel?.getPassword() ?? "");
      closeMenu();
    });

    const fillAction = createMenuAction(
      "Fill credentials",
      "Use a saved login from your vault",
      () => {
        requestCredentialFill(field, fieldType);
        closeMenu();
      },
    );

    generatorHost.append(generatorPanel.element);
    actions.append(quickGenerate, customizeAction, fillAction);
    menu.append(header, actions, generatorHost);
  } else {
    const fillAction = createMenuAction(
      "Fill credentials",
      "Use a saved login from your vault",
      () => {
        requestCredentialFill(field, fieldType);
        closeMenu();
      },
    );
    actions.append(fillAction);
    menu.append(header, actions);
  }

  const portalRoot = getMenuPortalRoot();
  portalRoot.append(menu);
  root.append(trigger);
  mountFieldTrigger(host);
  registerFieldOverlay(host, field);

  let unbindReposition: (() => void) | null = null;

  const closeMenu = () => {
    menu.hidden = true;
    trigger.setAttribute("aria-expanded", "false");
    if (generatorHost) {
      generatorHost.hidden = true;
    }
    customizeAction?.setAttribute("aria-expanded", "false");
    unbindReposition?.();
    unbindReposition = null;
  };

  const openMenu = () => {
    menu.hidden = false;
    trigger.setAttribute("aria-expanded", "true");
    positionFloatingMenu(menu, field);
    unbindReposition?.();
    unbindReposition = bindMenuReposition(menu, field, () => !menu.hidden);
  };

  trigger.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
    if (menu.hidden) {
      openMenu();
    } else {
      closeMenu();
    }
  });

  document.addEventListener(
    "click",
    (event) => {
      if (menu.hidden) {
        return;
      }
      const path = event.composedPath();
      const clickedInside = path.includes(host) || path.includes(menu);
      if (!clickedInside) {
        closeMenu();
      }
    },
    true,
  );

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !menu.hidden) {
      closeMenu();
    }
  });
}

function createMenuAction(
  label: string,
  description: string,
  onSelect: () => void,
): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "vl-menu-item";
  button.setAttribute("role", "menuitem");

  const title = document.createElement("span");
  title.className = "vl-menu-item-label";
  title.textContent = label;

  const hint = document.createElement("span");
  hint.className = "vl-menu-item-hint";
  hint.textContent = description;

  button.append(title, hint);
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
    onSelect();
  });

  return button;
}

function requestCredentialFill(field: HTMLInputElement, fieldType: "username" | "password"): void {
  safeSendMessage({
    type: "INDICATOR_CLICKED",
    hostname: window.location.hostname,
    fieldType,
    associatedFieldId: field.dataset.vaultlockAssociatedUsernameId || undefined,
  });
}

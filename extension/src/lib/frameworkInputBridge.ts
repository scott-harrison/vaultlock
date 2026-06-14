type FrameworkHandler = (element: HTMLInputElement, value: string) => boolean;

type ReactFiberNode = {
  memoizedProps?: {
    onChange?: (event: FrameworkInputEvent) => void;
    onInput?: (event: FrameworkInputEvent) => void;
    value?: string;
  };
  pendingProps?: {
    onChange?: (event: FrameworkInputEvent) => void;
    onInput?: (event: FrameworkInputEvent) => void;
    value?: string;
  };
  return?: ReactFiberNode | null;
  child?: ReactFiberNode | null;
  sibling?: ReactFiberNode | null;
};

interface FrameworkInputEvent {
  target: HTMLInputElement;
  currentTarget: HTMLInputElement;
  bubbles?: boolean;
  cancelable?: boolean;
  type?: string;
  preventDefault?: () => void;
  stopPropagation?: () => void;
}

function reactPropertyKey(element: Element, prefix: string): string | undefined {
  return Object.keys(element).find((key) => key.startsWith(prefix));
}

function createHandlerEvent(
  element: HTMLInputElement,
  type: "input" | "change",
): FrameworkInputEvent {
  return {
    target: element,
    currentTarget: element,
    bubbles: true,
    cancelable: true,
    type,
    preventDefault: () => {},
    stopPropagation: () => {},
  };
}

function invokeReactHandler(
  handler: ((event: FrameworkInputEvent) => void) | undefined,
  element: HTMLInputElement,
  type: "input" | "change",
): boolean {
  if (typeof handler !== "function") {
    return false;
  }

  handler(createHandlerEvent(element, type));
  return true;
}

function invokeReactInputHandlers(
  handlers: {
    onChange?: (event: FrameworkInputEvent) => void;
    onInput?: (event: FrameworkInputEvent) => void;
  },
  element: HTMLInputElement,
): boolean {
  const handledInput = invokeReactHandler(handlers.onInput, element, "input");
  const handledChange = invokeReactHandler(handlers.onChange, element, "change");
  return handledInput || handledChange;
}

function triggerReactPropsHandlers(element: Element): {
  onChange?: (event: FrameworkInputEvent) => void;
  onInput?: (event: FrameworkInputEvent) => void;
} | null {
  const propsKey =
    reactPropertyKey(element, "__reactProps$") ??
    reactPropertyKey(element, "__reactEventHandlers$");

  if (!propsKey) {
    return null;
  }

  const props = (element as Element & Record<string, unknown>)[propsKey] as
    | {
        onChange?: (event: FrameworkInputEvent) => void;
        onInput?: (event: FrameworkInputEvent) => void;
      }
    | undefined;

  return props ?? null;
}

function walkReactFiberTree(
  start: ReactFiberNode | null | undefined,
  visit: (node: ReactFiberNode) => boolean,
  limit = 48,
): boolean {
  const queue: ReactFiberNode[] = [];
  const seen = new Set<ReactFiberNode>();

  if (start) {
    queue.push(start);
  }

  while (queue.length > 0 && seen.size < limit) {
    const node = queue.shift();
    if (!node || seen.has(node)) {
      continue;
    }

    seen.add(node);
    if (visit(node)) {
      return true;
    }

    if (node.child) {
      queue.push(node.child);
    }
    if (node.sibling) {
      queue.push(node.sibling);
    }
    if (node.return) {
      queue.push(node.return);
    }
  }

  return false;
}

function triggerReactFiberHandlers(element: HTMLInputElement): boolean {
  const fiberKey =
    reactPropertyKey(element, "__reactFiber$") ??
    reactPropertyKey(element, "__reactInternalInstance$");

  if (!fiberKey) {
    return false;
  }

  const rootFiber = (element as Element & Record<string, unknown>)[fiberKey] as
    | ReactFiberNode
    | undefined;

  return walkReactFiberTree(rootFiber, (node) => {
    const props = node.memoizedProps ?? node.pendingProps;
    if (!props) {
      return false;
    }
    return invokeReactInputHandlers(props, element);
  });
}

function triggerVueModelHandlers(element: HTMLInputElement, value: string): boolean {
  const vueInstance = (
    element as Element & { __vueParentComponent?: { ctx?: Record<string, unknown> } }
  ).__vueParentComponent;

  if (!vueInstance?.ctx) {
    return false;
  }

  const vnodeProps = (
    element as Element & { _vei?: Record<string, { value?: { fn?: (event: Event) => void } }> }
  )._vei;

  if (vnodeProps) {
    for (const binding of Object.values(vnodeProps)) {
      if (typeof binding?.value?.fn === "function") {
        element.value = value;
        binding.value.fn({ target: element, currentTarget: element } as Event);
        return true;
      }
    }
  }

  return false;
}

function assignValueForFramework(element: HTMLInputElement, value: string): void {
  const prototype = HTMLInputElement.prototype;
  const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");
  const setter = descriptor?.set;

  const tracker = (
    element as HTMLInputElement & { _valueTracker?: { setValue: (value: string) => void } }
  )._valueTracker;
  if (tracker) {
    tracker.setValue(element.value);
  }

  if (setter) {
    setter.call(element, value);
  } else {
    element.value = value;
  }
}

function triggerReactOnElement(element: HTMLInputElement): boolean {
  const props = triggerReactPropsHandlers(element);
  let handled = false;

  if (props) {
    handled = invokeReactInputHandlers(props, element);
  }

  if (!handled) {
    handled = triggerReactFiberHandlers(element);
  }

  return handled;
}

function triggerReactFiberHandlersForElement(host: Element, element: HTMLInputElement): boolean {
  const fiberKey =
    reactPropertyKey(host, "__reactFiber$") ?? reactPropertyKey(host, "__reactInternalInstance$");

  if (!fiberKey) {
    return false;
  }

  return walkReactFiberTree(
    (host as Element & Record<string, unknown>)[fiberKey] as ReactFiberNode,
    (node) => {
      const props = node.memoizedProps ?? node.pendingProps;
      if (!props) {
        return false;
      }
      return invokeReactInputHandlers(props, element);
    },
  );
}

function triggerReactControlledInput(element: HTMLInputElement, value: string): boolean {
  assignValueForFramework(element, value);

  let node: Element | null = element;
  while (node && node !== document.documentElement) {
    if (node === element && triggerReactOnElement(element)) {
      return true;
    }

    if (triggerReactFiberHandlersForElement(node, element)) {
      return true;
    }

    const propsKey =
      reactPropertyKey(node, "__reactProps$") ?? reactPropertyKey(node, "__reactEventHandlers$");
    if (propsKey) {
      const props = (node as Element & Record<string, unknown>)[propsKey] as {
        onChange?: (event: FrameworkInputEvent) => void;
        onInput?: (event: FrameworkInputEvent) => void;
      };
      if (invokeReactInputHandlers(props, element)) {
        return true;
      }
    }

    node = node.parentElement;
  }

  return false;
}

const FRAMEWORK_HANDLERS: FrameworkHandler[] = [
  triggerReactControlledInput,
  triggerVueModelHandlers,
];

export function tryFrameworkControlledFill(element: HTMLInputElement, value: string): boolean {
  element.focus({ preventScroll: true });

  for (const handler of FRAMEWORK_HANDLERS) {
    if (handler(element, value)) {
      return true;
    }
  }

  return false;
}

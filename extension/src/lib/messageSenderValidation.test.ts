import { describe, expect, it } from "vitest";
import {
  hostnamesMatch,
  isExtensionPrivilegedSender,
  isTrustedContentScriptSender,
} from "./messageSenderValidation";

const EXTENSION_ID = "abcdefghijklmnopqrstuvwxyzabcdef";

function sender(partial: chrome.runtime.MessageSender): chrome.runtime.MessageSender {
  return { id: EXTENSION_ID, ...partial };
}

describe("messageSenderValidation", () => {
  it("accepts extension service worker senders", () => {
    expect(isExtensionPrivilegedSender(sender({ tab: undefined }))).toBe(true);
  });

  it("accepts extension popup pages opened as tabs", () => {
    expect(
      isExtensionPrivilegedSender(
        sender({
          tab: { id: 1 } as chrome.tabs.Tab,
          url: `chrome-extension://${EXTENSION_ID}/popup.html`,
        }),
      ),
    ).toBe(true);
  });

  it("rejects content-script senders for privileged handlers", () => {
    expect(
      isExtensionPrivilegedSender(
        sender({
          tab: { id: 1, url: "https://bank.example/login" } as chrome.tabs.Tab,
          url: "https://bank.example/login",
          frameId: 0,
        }),
      ),
    ).toBe(false);
  });

  it("accepts trusted content-script senders on web pages", () => {
    expect(
      isTrustedContentScriptSender(
        sender({
          tab: { id: 1, url: "https://bank.example/login" } as chrome.tabs.Tab,
          frameId: 0,
        }),
      ),
    ).toBe(true);
  });

  it("matches hostnames case-insensitively", () => {
    expect(hostnamesMatch("Example.COM", "example.com")).toBe(true);
  });
});

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { type BrowserContext, type Page, test as base } from "@playwright/test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extensionPath = path.resolve(__dirname, "../../build/chrome-mv3-prod");
const pagesDir = path.join(__dirname, "../pages");
const TEST_ORIGIN = "http://127.0.0.1:8765";

async function fulfillTestPage(route: import("@playwright/test").Route): Promise<void> {
  const fileName = new URL(route.request().url()).pathname.slice(1) || "login-form.html";
  const filePath = path.join(pagesDir, fileName);
  const body = await fs.readFile(filePath, "utf8");
  await route.fulfill({
    status: 200,
    contentType: "text/html; charset=utf-8",
    body,
  });
}

export const test = base.extend<{ extensionContext: BrowserContext; page: Page }>({
  extensionContext: async ({ playwright }, use) => {
    const context = await playwright.chromium.launchPersistentContext("", {
      channel: "chromium",
      headless: false,
      args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
    });

    await use(context);
    await context.close();
  },
  page: async ({ extensionContext }, use) => {
    const page = await extensionContext.newPage();
    await page.route(`${TEST_ORIGIN}/**`, fulfillTestPage);
    await use(page);
  },
});

export { expect } from "@playwright/test";

export const testPages = {
  login: `${TEST_ORIGIN}/login-form.html`,
  signup: `${TEST_ORIGIN}/signup-form.html`,
  appleLikeLogin: `${TEST_ORIGIN}/apple-like-login.html`,
  reactLogin: `${TEST_ORIGIN}/react-login-form.html`,
  trustedInputLogin: `${TEST_ORIGIN}/trusted-input-login.html`,
  reactControlledLogin: `${TEST_ORIGIN}/react-controlled-login.html`,
  spaDelayedLogin: `${TEST_ORIGIN}/spa-delayed-login.html`,
  iframeLogin: `${TEST_ORIGIN}/iframe-login.html`,
};

export async function getExtensionServiceWorker(context: BrowserContext) {
  let [serviceWorker] = context.serviceWorkers();
  if (!serviceWorker) {
    serviceWorker = await context.waitForEvent("serviceworker", { timeout: 15000 });
  }
  return serviceWorker;
}

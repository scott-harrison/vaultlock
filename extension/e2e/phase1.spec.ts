import { expect, getExtensionServiceWorker, test, testPages } from "./fixtures/extension";

async function waitForFieldTrigger(page: import("@playwright/test").Page): Promise<void> {
  await expect(page.locator("[data-vaultlock-trigger]").first()).toBeVisible({ timeout: 15000 });
}

test.describe("Phase 1 extension smoke flows", () => {
  test("injects VaultLock triggers on login fields", async ({ page }) => {
    await page.goto(testPages.login);

    await waitForFieldTrigger(page);
    const triggers = page.locator("[data-vaultlock-trigger]");
    await expect(triggers).toHaveCount(2);
  });

  test("injects a single trigger on Apple-like single-step login pages", async ({ page }) => {
    await page.goto(testPages.appleLikeLogin);
    await waitForFieldTrigger(page);

    const triggers = page.locator("[data-vaultlock-trigger]");
    await expect(triggers).toHaveCount(1);
    await expect(triggers.first()).toBeVisible();
  });

  test("opens inline match menu with vault status", async ({ page }) => {
    await page.goto(testPages.login);
    await waitForFieldTrigger(page);

    await page.locator("[data-vaultlock-trigger]").last().click();

    const menuPortal = page.locator("[data-vaultlock-menu-portal]");
    const openMenu = menuPortal.locator(".vl-menu:not([hidden])");
    await expect(openMenu).toBeVisible();
    await expect(
      openMenu.getByText(/matching login|Unlock your vault|No saved logins|Loading matching/i),
    ).toBeVisible();
    await expect(openMenu.getByRole("menuitem", { name: "Open full vault" })).toBeVisible();
  });

  test("generates a password into a new-password field", async ({ page }) => {
    await page.goto(testPages.signup);
    await waitForFieldTrigger(page);

    const passwordField = page.locator("#new-password");
    await expect(passwordField).toHaveValue("");

    await page.locator("[data-vaultlock-trigger]").nth(1).click();
    const menuPortal = page.locator("[data-vaultlock-menu-portal]");
    await menuPortal
      .locator(".vl-menu:not([hidden])")
      .getByRole("menuitem", { name: "Generate password" })
      .click();

    await expect(passwordField).not.toHaveValue("");
    await expect(passwordField).toHaveValue(/.{12,}/);
  });

  test("fills credentials when background sends EXECUTE_FILL", async ({
    page,
    extensionContext,
  }) => {
    await page.goto(testPages.login);
    await waitForFieldTrigger(page);

    const serviceWorker = await getExtensionServiceWorker(extensionContext);
    const fillResult = await serviceWorker.evaluate(async () => {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const tabId = tabs[0]?.id;
      if (!tabId) {
        return { success: false, error: "No active tab" };
      }

      return chrome.tabs.sendMessage(tabId, {
        type: "EXECUTE_FILL",
        hostname: "127.0.0.1",
        fieldType: "password",
        username: "e2e-user@example.com",
        password: "E2E-Test-Password-42!",
      });
    });

    expect(fillResult).toMatchObject({ success: true });

    await expect(page.locator("#username")).toHaveValue("e2e-user@example.com");
    await expect(page.locator("#password")).toHaveValue("E2E-Test-Password-42!");
  });
});

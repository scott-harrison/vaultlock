import { expect, getExtensionServiceWorker, test, testPages } from "./fixtures/extension";
import {
  clearExtensionState,
  getExtensionId,
  seedAuthenticatedExtension,
  seedUnlockedVaultExtension,
  seedUnlockedVaultExtensionWithRelatedDomainLogin,
} from "./fixtures/seedExtension";
import {
  E2E_RELATED_DOMAIN_LOGIN_ITEM,
  E2E_TEST_CREDENTIALS,
  E2E_TEST_LOGIN_ITEM,
} from "./fixtures/testVault";

async function waitForFieldTrigger(page: import("@playwright/test").Page): Promise<void> {
  await expect(page.locator("[data-vaultlock-trigger]").first()).toBeVisible({ timeout: 15000 });
}

test.describe("Phase 1 extension flows (seeded state)", () => {
  test.beforeEach(async ({ extensionContext }) => {
    const serviceWorker = await getExtensionServiceWorker(extensionContext);
    await clearExtensionState(serviceWorker);
  });

  test("inline fill enables continue button on react-controlled inputs", async ({
    page,
    extensionContext,
  }) => {
    const serviceWorker = await getExtensionServiceWorker(extensionContext);
    await seedUnlockedVaultExtension(serviceWorker);

    await page.goto(testPages.reactControlledLogin);
    await waitForFieldTrigger(page);
    await expect(page.locator("#continue")).toBeDisabled();

    await page.locator("[data-vaultlock-trigger]").first().click();
    const menuPortal = page.locator("[data-vaultlock-menu-portal]");
    await menuPortal
      .locator(".vl-menu:not([hidden])")
      .getByRole("menuitem", { name: E2E_TEST_LOGIN_ITEM.title })
      .click();

    await expect(page.locator("#email")).toHaveValue(E2E_TEST_CREDENTIALS.email);
    await expect(page.locator("#continue")).toBeEnabled();
  });

  test("inline fill enables continue button on trusted-input validators", async ({
    page,
    extensionContext,
  }) => {
    const serviceWorker = await getExtensionServiceWorker(extensionContext);
    await seedUnlockedVaultExtension(serviceWorker);

    await page.goto(testPages.trustedInputLogin);
    await waitForFieldTrigger(page);
    await expect(page.locator("#continue")).toBeDisabled();

    await page.locator("[data-vaultlock-trigger]").first().click();
    const menuPortal = page.locator("[data-vaultlock-menu-portal]");
    await menuPortal
      .locator(".vl-menu:not([hidden])")
      .getByRole("menuitem", { name: E2E_TEST_LOGIN_ITEM.title })
      .click();

    await expect(page.locator("#email")).toHaveValue(E2E_TEST_CREDENTIALS.email);
    await expect(page.locator("#continue")).toBeEnabled();
  });

  test("inline fill enables continue button on react-style validators", async ({
    page,
    extensionContext,
  }) => {
    const serviceWorker = await getExtensionServiceWorker(extensionContext);
    await seedUnlockedVaultExtension(serviceWorker);

    await page.goto(testPages.reactLogin);
    await waitForFieldTrigger(page);
    await expect(page.locator("#continue")).toBeDisabled();

    await page.locator("[data-vaultlock-trigger]").first().click();
    const menuPortal = page.locator("[data-vaultlock-menu-portal]");
    await menuPortal
      .locator(".vl-menu:not([hidden])")
      .getByRole("menuitem", { name: E2E_TEST_LOGIN_ITEM.title })
      .click();

    await expect(page.locator("#email")).toHaveValue(E2E_TEST_CREDENTIALS.email);
    await expect(page.locator("#continue")).toBeEnabled();
  });

  test("inline match selection fills username on Apple-like step-1 pages", async ({
    page,
    extensionContext,
  }) => {
    const serviceWorker = await getExtensionServiceWorker(extensionContext);
    await seedUnlockedVaultExtension(serviceWorker);

    await page.goto(testPages.appleLikeLogin);
    await waitForFieldTrigger(page);

    await page.locator("[data-vaultlock-trigger]").first().click();

    const menuPortal = page.locator("[data-vaultlock-menu-portal]");
    const openMenu = menuPortal.locator(".vl-menu:not([hidden])");
    await expect(openMenu.getByText("1 matching login")).toBeVisible({ timeout: 10000 });
    await openMenu.getByRole("menuitem", { name: E2E_TEST_LOGIN_ITEM.title }).click();

    await expect(page.locator("#account_name_text_field")).toHaveValue(E2E_TEST_CREDENTIALS.email);
    await expect(page.locator("#sign-in")).toBeEnabled();
  });

  test("inline fill matches logins via user-managed related domains", async ({
    page,
    extensionContext,
  }) => {
    const serviceWorker = await getExtensionServiceWorker(extensionContext);
    await seedUnlockedVaultExtensionWithRelatedDomainLogin(serviceWorker);

    await page.goto(testPages.login);
    await waitForFieldTrigger(page);

    await page.locator("[data-vaultlock-trigger]").last().click();

    const menuPortal = page.locator("[data-vaultlock-menu-portal]");
    const openMenu = menuPortal.locator(".vl-menu:not([hidden])");
    await expect(openMenu.getByText("1 matching login")).toBeVisible({ timeout: 10000 });
    await openMenu.getByRole("menuitem", { name: E2E_RELATED_DOMAIN_LOGIN_ITEM.title }).click();

    await expect(page.locator("#username")).toHaveValue(E2E_TEST_CREDENTIALS.email);
    await expect(page.locator("#password")).toHaveValue(E2E_TEST_CREDENTIALS.password);
  });

  test("inline match selection fills credentials when vault is unlocked", async ({
    page,
    extensionContext,
  }) => {
    const serviceWorker = await getExtensionServiceWorker(extensionContext);
    await seedUnlockedVaultExtension(serviceWorker);

    await page.goto(testPages.login);
    await waitForFieldTrigger(page);

    await page.locator("[data-vaultlock-trigger]").last().click();

    const menuPortal = page.locator("[data-vaultlock-menu-portal]");
    const openMenu = menuPortal.locator(".vl-menu:not([hidden])");
    await expect(openMenu.getByText("1 matching login")).toBeVisible({ timeout: 10000 });
    await openMenu.getByRole("menuitem", { name: E2E_TEST_LOGIN_ITEM.title }).click();

    await expect(page.locator("#username")).toHaveValue(E2E_TEST_CREDENTIALS.email);
    await expect(page.locator("#password")).toHaveValue(E2E_TEST_CREDENTIALS.password);
  });

  test("shows save-login banner after form submit when authenticated", async ({
    page,
    extensionContext,
  }) => {
    const serviceWorker = await getExtensionServiceWorker(extensionContext);
    await seedAuthenticatedExtension(serviceWorker);

    await page.goto(testPages.login);
    await waitForFieldTrigger(page);

    await page.locator("#username").fill(E2E_TEST_CREDENTIALS.email);
    await page.locator("#password").fill("brand-new-password-99!");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page.getByText("Save login to VaultLock?")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(E2E_TEST_CREDENTIALS.email)).toBeVisible();
    await expect(page.getByRole("button", { name: "Save" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Not now" })).toBeVisible();
  });

  test("open full vault queues a pending fill request for the popup flow", async ({
    page,
    extensionContext,
  }) => {
    const serviceWorker = await getExtensionServiceWorker(extensionContext);
    await seedAuthenticatedExtension(serviceWorker);

    await page.goto(testPages.login);
    await waitForFieldTrigger(page);

    await page.locator("[data-vaultlock-trigger]").last().click();
    const menuPortal = page.locator("[data-vaultlock-menu-portal]");
    await menuPortal
      .locator(".vl-menu:not([hidden])")
      .getByRole("menuitem", { name: "Open full vault" })
      .click();

    await expect
      .poll(
        async () => {
          const stored = await serviceWorker.evaluate(async () => {
            const result = await chrome.storage.session.get("pendingFillRequest");
            const pending = result.pendingFillRequest as { hostname?: string } | undefined;
            return pending?.hostname ?? null;
          });
          return stored;
        },
        { timeout: 5000 },
      )
      .toBe("127.0.0.1");

    const extensionId = getExtensionId(serviceWorker);
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    await expect(page.getByText("Unlock to fill saved credentials on 127.0.0.1.")).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByRole("button", { name: "Unlock vault" })).toBeVisible();
  });
});

import { test, expect, type Page } from "@playwright/test";

// Core happy path (acceptance): log in → add a property → track a transaction →
// view the dashboard → generate a report. Runs against the seeded `e2e` account,
// which is verified and has an active subscription so premium views are ungated.

const E2E_EMAIL = "e2e@landland.app";
const E2E_PASSWORD = "Password123!";

// Suppress first-visit onboarding coachmarks (localStorage-backed) and record a
// cookie-consent choice, so neither overlay blocks interactions during the run.
async function prepare(page: Page) {
  await page.addInitScript(() => {
    const orig = Storage.prototype.getItem;
    Storage.prototype.getItem = function (key: string) {
      if (key.startsWith("landland.coachmark")) return "seen";
      return orig.call(this, key);
    };
    document.cookie = "landland_cookie_consent=essential;path=/;max-age=31536000";
  });
}

async function login(page: Page) {
  await prepare(page);
  await page.goto("/login");
  await page.locator('input[type="email"]').fill(E2E_EMAIL);
  await page.locator('input[type="password"]').fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/dashboard");
}

test("happy path: add property → track transaction → view dashboard → generate report", async ({ page }) => {
  await login(page);

  // --- View dashboard ---
  await expect(page.getByRole("heading", { name: "Overview", level: 1 })).toBeVisible();

  // --- Add a property ---
  await page.goto("/properties");
  await expect(page.getByRole("heading", { name: "Properties", level: 1 })).toBeVisible();

  const nickname = `E2E Villa ${Date.now()}`;
  await page.getByRole("button", { name: "Add Property", exact: true }).click();
  const propDialog = page.getByRole("dialog");
  await expect(propDialog).toBeVisible();
  await propDialog.getByLabel("Property name").fill(nickname);
  await propDialog.getByLabel("Address line 1").fill("1 Test Street");
  await propDialog.getByLabel("City").fill("Bristol");
  await propDialog.getByLabel("Postcode").fill("BS1 1AA");
  await propDialog.getByRole("button", { name: "Add property" }).click();

  // The new property card appears.
  await expect(page.getByRole("heading", { name: nickname })).toBeVisible();

  // --- Track a transaction ---
  await page.goto("/transactions");
  await expect(page.getByRole("heading", { name: "Transactions", level: 1 })).toBeVisible();

  const description = `E2E Rent ${Date.now()}`;
  await page.getByRole("button", { name: "Add transaction", exact: true }).click();
  const txDialog = page.getByRole("dialog");
  await expect(txDialog).toBeVisible();
  await txDialog.getByLabel("Direction").selectOption("income");
  await txDialog.getByLabel("Amount (£)").fill("950");
  await txDialog.getByLabel("Description").fill(description);
  await txDialog.getByRole("button", { name: "Add transaction" }).click();

  // The new transaction shows in the ledger.
  await expect(page.getByText(description)).toBeVisible();

  // --- Back to the dashboard ---
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Overview", level: 1 })).toBeVisible();

  // --- Generate a report (ungated for this account) ---
  await page.goto("/reports");
  await expect(page.getByRole("heading", { name: "Reports", level: 1 })).toBeVisible();
  // Not gated: the locked overlay must NOT appear.
  await expect(page.getByText("Unlock your data")).toHaveCount(0);
  // The report explorer renders a report with export actions (proof it generated).
  await expect(page.getByRole("heading", { name: "Report types" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Export CSV" })).toBeVisible();
});

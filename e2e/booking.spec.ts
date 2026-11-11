import { expect, test } from "@playwright/test";

// Kernablauf der Demo: Besucher bucht eine Neubespannung – Auto wählen, Arbeit wählen, Termin, Kontakt, senden.
test("visitor books a dashboard re-trim", async ({ page }) => {
  await page.goto("./");
  await page.getByRole("button", { name: "EN", exact: true }).first().click();
  await expect(page.getByText("Your dashboard, in new leather.")).toBeVisible();

  const order = page.locator("section#order");
  await order.scrollIntoViewIfNeeded();

  // 1. Auto
  await order.getByLabel("Make").selectOption("bmw");
  await order.getByLabel("Model").selectOption({ index: 1 });
  await order.getByRole("button", { name: "Next" }).click();

  // 2. Arbeit
  await order.getByRole("button", { name: /Dashboard re-trim/ }).click();
  await order.getByRole("button", { name: "Next" }).click();

  // 3. Fotos (optional)
  await order.getByRole("button", { name: "Next" }).click();

  // 4. Termin: erster freier Tag
  await order.locator("button[aria-pressed]:not([disabled])").first().click();
  await order.getByRole("button", { name: "Next" }).click();

  // 5. Kontakt
  await order.getByLabel("Name").fill("Playwright Test");
  await order.getByLabel("Phone").fill("+995 555 00 00 00");
  await order.getByRole("button", { name: "Send request" }).click();

  await expect(order.getByText("Request sent")).toBeVisible();
});

test("workshop admin shows the order pipeline", async ({ page }) => {
  await page.goto("./#/admin");
  await expect(page.locator("main")).toBeVisible();
  await expect(page.getByText(/AI-10\d\d/).first()).toBeVisible();
});

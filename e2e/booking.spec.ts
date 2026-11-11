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

  // Zwischen den Schritten auf die neue Überschrift warten – die Schritte blenden animiert über,
  // sonst landet ein Klick noch im ausblendenden Schritt.
  const step = (name: string) => expect(order.getByRole("heading", { level: 3, name })).toBeVisible();

  // 2. Arbeit
  await step("Work");
  // Neubespannung ist vorausgewählt – nur sicherstellen, dass sie aktiv ist
  const dash = order.getByRole("button", { name: /Dashboard re-trim/ });
  if ((await dash.getAttribute("aria-pressed")) !== "true") await dash.click();
  await expect(dash).toHaveAttribute("aria-pressed", "true");
  await order.getByRole("button", { name: "Next" }).click();

  // 3. Fotos (optional)
  await step("Photos");
  await order.getByRole("button", { name: "Next" }).click();

  // 4. Termin: erster freier Tag
  await step("Date");
  await order.locator("button[aria-pressed]:not([disabled])").first().click();
  await order.getByRole("button", { name: "Next" }).click();

  // 5. Kontakt
  await step("Contact");
  await order.getByLabel("Name").fill("Playwright Test");
  await order.getByLabel("Phone").fill("+995 555 00 00 00");
  await order.getByRole("button", { name: "Send request" }).click();

  await expect(order.getByText("Request sent")).toBeVisible();
});

test("workshop admin shows the order pipeline", async ({ page }) => {
  await page.goto("./#/admin");
  // with the backend (VITE_API_URL) the admin asks for a login first; the static demo opens directly
  const login = page.getByRole("button", { name: "Sign in" });
  await expect(login.or(page.getByText(/AI-10\d\d/).first())).toBeVisible();
  if (await login.isVisible()) {
    await page.getByLabel("Email").fill(process.env.E2E_ADMIN_EMAIL ?? "owner@autointeriore.demo");
    await page.getByLabel("Password").fill(process.env.E2E_ADMIN_PASSWORD ?? "werkstatt-demo");
    await login.click();
  }
  await expect(page.locator("main")).toBeVisible();
  await expect(page.getByText(/AI-10\d\d/).first()).toBeVisible();
});

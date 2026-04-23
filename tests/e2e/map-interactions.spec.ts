import { expect, test } from "@playwright/test";

test("layer toggle updates UI state", async ({ page }) => {
  await page.goto("/map");

  const toggle = page.getByTestId("layer-toggle-departments");
  await expect(toggle).toBeChecked();
  await toggle.uncheck();
  await expect(toggle).not.toBeChecked();
});

test("searching for area selects feature and opens detail panel", async ({ page }) => {
  await page.goto("/map");

  await page.getByTestId("search-input").fill("Alta");
  await page.getByRole("button", { name: /Alta Verapaz/i }).click();

  await expect(page.getByTestId("feature-detail-panel")).toBeVisible();
  await expect(page.getByTestId("feature-title")).toContainText("Alta Verapaz");
  await expect(page.getByText("Departamento")).toBeVisible();
});

test("search empty result stays controlled", async ({ page }) => {
  await page.goto("/map");

  await page.getByTestId("search-input").fill("zz");
  await expect(page.getByTestId("search-empty")).toHaveText("No hay resultados");
});

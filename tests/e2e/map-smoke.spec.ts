import { expect, test } from "@playwright/test";

test("map page loads with fixture mode and no visible crash", async ({ page }) => {
  await page.goto("/map");

  await expect(page.getByTestId("map-shell")).toBeVisible();
  await expect(page.getByTestId("map-canvas").first()).toBeVisible();
  await expect(page.getByTestId("search-input")).toBeVisible();
  await expect(page.getByText("BioGT / Atlas vivo de Guatemala")).toBeVisible();
  await expect(page.getByText("No se pudo iniciar el mapa")).toHaveCount(0);
});

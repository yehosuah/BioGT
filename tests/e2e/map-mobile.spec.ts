import { expect, test } from "@playwright/test";

test("mobile viewport keeps search reachable and bottom sheet usable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/map");

  await expect(page.getByTestId("map-canvas").first()).toBeVisible();
  await expect(page.getByTestId("search-input")).toBeVisible();

  await page.getByRole("button", { name: /Quetzal/i }).first().click();
  await expect(page.getByTestId("mobile-bottom-sheet")).toBeVisible();
});

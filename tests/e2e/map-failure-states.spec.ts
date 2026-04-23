import { expect, test } from "@playwright/test";

test("layer failure shows controlled error state", async ({ page }) => {
  await page.route("**/map-test-fixtures/api/layers/departments.json", async (route) => {
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ error: "forced failure" })
    });
  });

  await page.goto("/map");

  await expect(page.getByText("Hay capas con error.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Reintentar" })).toBeVisible();
});

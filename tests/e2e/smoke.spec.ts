import { expect, test } from "@playwright/test";

test("loads sign-in page", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/ThreadForge/i);
  await expect(
    page.getByRole("heading", { name: /sign in to threadforge/i }),
  ).toBeVisible();
});

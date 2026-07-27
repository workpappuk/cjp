import { expect, test } from "@playwright/test";
import { DashboardPage } from "@/tests/e2e/pages/DashboardPage";
import { LoginPage } from "@/tests/e2e/pages/LoginPage";
import { NavigationPage } from "@/tests/e2e/pages/NavigationPage";

test.describe("Auth, Registration, Dashboard, Navigation, Logout", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/api/posts**", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([]),
        });
        return;
      }

      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          id: "post-e2e-1",
          title: "E2E Post",
          content: "E2E Content",
          communities: ["general"],
          moderationStatus: "approved",
          createdAt: new Date().toISOString(),
        }),
      });
    });

    await page.route("**/api/communities**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([{ id: "community-1", name: "general", tags: [] }]),
      });
    });

    await page.route("**/api/tags**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
    });

    await page.route("**/api/user-profile**", async (route) => {
      if (route.request().method() === "PUT") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ joinedCommunities: ["general"] }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: "profile-1",
          email: "user@test.threadforge.dev",
          joinedCommunities: ["general"],
        }),
      });
    });
  });

  test("login and dashboard load", async ({ page }) => {
    const loginPage = new LoginPage(page);
    const dashboardPage = new DashboardPage(page);

    await loginPage.goto();
    await loginPage.expectLoaded();

    await loginPage.bootstrapAuthenticatedSession();
    await dashboardPage.goto();
    await dashboardPage.expectLoaded();
  });

  test("registration profile bootstrap and navigation", async ({ page }) => {
    const loginPage = new LoginPage(page);
    const dashboardPage = new DashboardPage(page);
    const navigationPage = new NavigationPage(page);

    await loginPage.bootstrapAuthenticatedSession("new-user@test.threadforge.dev");
    await dashboardPage.goto();
    await dashboardPage.expectLoaded();

    await navigationPage.goToHomeFromDashboard();
  });

  test("logout clears auth and redirects to sign-in", async ({ page }) => {
    const loginPage = new LoginPage(page);
    const dashboardPage = new DashboardPage(page);

    await loginPage.bootstrapAuthenticatedSession();
    await dashboardPage.goto();
    await dashboardPage.expectLoaded();

    await loginPage.clearSession();
    await page.reload();

    await expect(page).toHaveURL(/\/$/);
  });
});

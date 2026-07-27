import { expect, test } from "@playwright/test";
import { DashboardPage } from "@/tests/e2e/pages/DashboardPage";
import { LoginPage } from "@/tests/e2e/pages/LoginPage";

test.describe("CRUD flow", () => {
  test("create post request and UI flow", async ({ page }) => {
    const posts: Array<{ id: string; title: string; content: string; communities: string[] }> = [];

    await page.route("**/api/posts**", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(posts),
        });
        return;
      }

      if (route.request().method() === "POST") {
        const payload = (await route.request().postDataJSON()) as {
          title: string;
          content: string;
          communities: string[];
        };

        const created = {
          id: `post-${posts.length + 1}`,
          title: payload.title,
          content: payload.content,
          communities: payload.communities,
        };

        posts.unshift(created);

        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({
            ...created,
            moderationStatus: "approved",
            createdAt: new Date().toISOString(),
          }),
        });
        return;
      }

      await route.continue();
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

    const loginPage = new LoginPage(page);
    const dashboardPage = new DashboardPage(page);

    await loginPage.bootstrapAuthenticatedSession();
    await dashboardPage.goto();
    await dashboardPage.expectLoaded();

    const title = "Playwright CRUD Post";
    await dashboardPage.createPost(title, "Playwright CRUD body");

    await expect.poll(() => posts.length).toBe(1);
    await dashboardPage.expectPostVisible(title);
  });
});

import { expect, type Page } from "@playwright/test";

export class LoginPage {
  constructor(private readonly page: Page) {}

  async goto() {
    await this.page.goto("/");
  }

  async expectLoaded() {
    await expect(this.page).toHaveTitle(/ThreadForge/i);
    await expect(
      this.page.getByRole("heading", { name: /sign in to threadforge/i }),
    ).toBeVisible();
  }

  async bootstrapAuthenticatedSession(email = "user@test.threadforge.dev") {
    const now = Date.now();

    await this.page.addInitScript(
      ({ issuedAt, userEmail }) => {
        window.localStorage.setItem("threadforge-auth", "google");
        window.localStorage.setItem("threadforge-access-token", "tf_google_e2e");
        window.localStorage.setItem(
          "threadforge-access-token-expiry",
          String(issuedAt + 60 * 60 * 1000),
        );
        window.localStorage.setItem(
          "threadforge-user-profile",
          JSON.stringify({ email: userEmail, provider: "google" }),
        );
      },
      { issuedAt: now, userEmail: email },
    );
  }

  async clearSession() {
    await this.page.evaluate(() => {
      window.localStorage.removeItem("threadforge-auth");
      window.localStorage.removeItem("threadforge-access-token");
      window.localStorage.removeItem("threadforge-access-token-expiry");
      window.localStorage.removeItem("threadforge-user-profile");
    });
  }
}

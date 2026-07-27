import { expect, type Page } from "@playwright/test";

export class DashboardPage {
  constructor(private readonly page: Page) {}

  async goto() {
    await this.page.goto("/pages/home");
  }

  async expectLoaded() {
    await expect(this.page).toHaveURL(/\/pages\/home/);
    await expect(this.page.locator("input").first()).toBeVisible();
  }

  async createPost(title: string, content: string) {
    await this.page.locator("input").first().fill(title);
    await this.page
      .getByPlaceholder("Share your thoughts with the community...")
      .fill(content);
    await this.page.getByRole("button", { name: /publish post/i }).click();
  }

  async expectPostVisible(title: string) {
    await expect(this.page.getByText(title)).toBeVisible();
  }
}

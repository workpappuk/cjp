import { expect, type Page } from "@playwright/test";

export class NavigationPage {
  constructor(private readonly page: Page) {}

  async goToHomeFromDashboard() {
    await this.page.goto("/pages/home");
    await expect(this.page).toHaveURL(/\/pages\/home/);
  }

  async goToCommunity(name: string) {
    await this.page.goto(`/pages/community/${name}`);
    await expect(this.page).toHaveURL(new RegExp(`/pages/community/${name}`));
  }

  async goToPost(postId: string) {
    await this.page.goto(`/pages/post/${postId}`);
    await expect(this.page).toHaveURL(new RegExp(`/pages/post/${postId}`));
  }
}

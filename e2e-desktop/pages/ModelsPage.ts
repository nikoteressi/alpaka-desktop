import { BasePage } from './BasePage'

export class ModelsPage extends BasePage {
  get modelCards(): ReturnType<WebdriverIO.Browser['$$']> {
    return $$('[data-testid="model-card"]')
  }

  get pullModelButton(): ReturnType<WebdriverIO.Browser['$']> {
    return $('[data-testid="pull-model-btn"]')
  }

  async getInstalledModelNames(): Promise<string[]> {
    const cards = await this.modelCards
    return Promise.all(cards.map((c) => c.getText()))
  }

  async waitForPullComplete(timeoutMs = 300000): Promise<void> {
    await this.driver.waitUntil(
      async () => {
        const bar = await $('[data-testid="pull-progress"]')
        return !(await bar.isExisting())
      },
      { timeout: timeoutMs, interval: 1000 }
    )
  }

  async navigateToLibrary(): Promise<void> {
    const libraryTab = await $('[data-testid="models-tab-library"]')
    await libraryTab.waitForDisplayed({ timeout: 5000 })
    await libraryTab.click()
    await this.driver.pause(300)
  }
}

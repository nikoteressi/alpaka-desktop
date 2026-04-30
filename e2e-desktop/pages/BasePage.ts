import { join } from 'path'
import { existsSync, mkdirSync } from 'fs'

export class BasePage {
  protected get driver(): WebdriverIO.Browser {
    return browser
  }

  async waitForAppReady(): Promise<void> {
    await $('[data-testid="app-root"]').waitForDisplayed({ timeout: 10000 })
  }

  async screenshotOnFail(testName: string): Promise<void> {
    const dir = join(__dirname, '../.artifacts')
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    const safe = testName.replace(/[^a-z0-9]/gi, '_').toLowerCase()
    await this.driver.saveScreenshot(join(dir, `${safe}_${Date.now()}.png`))
  }

  async clickNavIcon(slug: string): Promise<void> {
    // Nav items live in the collapsible sidebar — ensure it is open first
    const navItem = await $(`[data-testid="nav-${slug}"]`)
    const isVisible = await navItem.isDisplayed()
    if (!isVisible) {
      // Open the sidebar via its toggle button (first button in the icon strip)
      const toggle = await $('[data-testid="sidebar-toggle"]')
      if (await toggle.isExisting()) {
        await toggle.click()
        await this.driver.pause(200)
      }
    }
    await navItem.waitForDisplayed({ timeout: 5000 })
    await navItem.click()
    await this.driver.pause(300)
  }

  async openTab(tab: string): Promise<void> {
    const tabBtn = await $(`[data-testid="settings-tab-${tab}"]`)
    await tabBtn.waitForDisplayed({ timeout: 5000 })
    await tabBtn.click()
    await this.driver.pause(200)
  }
}

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

  async clickNavIcon(label: string): Promise<void> {
    const btn = await $(`[aria-label="${label}"]`)
    await btn.waitForDisplayed({ timeout: 5000 })
    await btn.click()
    await this.driver.pause(300)
  }

  async openTab(tab: string): Promise<void> {
    const tabBtn = await $(`[data-testid="settings-tab-${tab}"]`)
    await tabBtn.waitForDisplayed({ timeout: 5000 })
    await tabBtn.click()
    await this.driver.pause(200)
  }
}

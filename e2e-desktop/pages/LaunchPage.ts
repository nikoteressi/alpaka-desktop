import { BasePage } from './BasePage.js'

export class LaunchPage extends BasePage {
  get hostUrlInput(): ReturnType<WebdriverIO.Browser['$']> {
    return $('[data-testid="host-url-input"]')
  }

  get connectButton(): ReturnType<WebdriverIO.Browser['$']> {
    return $('[data-testid="connect-btn"]')
  }

  get hostStatus(): ReturnType<WebdriverIO.Browser['$']> {
    return $('[data-testid="host-status"]')
  }

  async connectToHost(url: string): Promise<void> {
    const input = await this.hostUrlInput
    await input.waitForDisplayed({ timeout: 5000 })
    await input.setValue(url)
    await this.connectButton.click()
  }

  async waitForConnected(timeoutMs = 15000): Promise<void> {
    await this.driver.waitUntil(
      async () => {
        const status = await $('[data-testid="host-status"]')
        const text = await status.getText()
        return text.toLowerCase().includes('connected') || text.toLowerCase().includes('online')
      },
      { timeout: timeoutMs, interval: 500 }
    )
  }
}

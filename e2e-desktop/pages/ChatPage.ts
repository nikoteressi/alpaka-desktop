import { BasePage } from './BasePage.js'

export class ChatPage extends BasePage {
  get messageInput(): ReturnType<WebdriverIO.Browser['$']> {
    return $('[data-testid="chat-input"]')
  }

  get sendButton(): ReturnType<WebdriverIO.Browser['$']> {
    return $('[data-testid="send-btn"]')
  }

  get modelSelector(): ReturnType<WebdriverIO.Browser['$']> {
    return $('[data-testid="model-selector"]')
  }

  get assistantMessages(): ReturnType<WebdriverIO.Browser['$$']> {
    return $$('[data-role="assistant"]')
  }

  get userMessages(): ReturnType<WebdriverIO.Browser['$$']> {
    return $$('[data-role="user"]')
  }

  get streamingIndicator(): ReturnType<WebdriverIO.Browser['$']> {
    return $('[data-testid="streaming-indicator"]')
  }

  async sendMessage(text: string): Promise<void> {
    const input = await this.messageInput
    await input.waitForDisplayed({ timeout: 5000 })
    await input.setValue(text)
    await this.sendButton.click()
  }

  async waitForStreamComplete(timeoutMs = 60000): Promise<void> {
    // streaming-indicator is rendered with display:none (v-if controls existence)
    // so check isExisting() rather than isDisplayed()
    await this.driver.waitUntil(
      async () => {
        const indicator = await $('[data-testid="streaming-indicator"]')
        return !(await indicator.isExisting())
      },
      { timeout: timeoutMs, interval: 500 }
    )
  }

  async lastAssistantMessageText(): Promise<string> {
    const messages = await this.assistantMessages
    if (messages.length === 0) throw new Error('No assistant messages found')
    return messages[messages.length - 1].getText()
  }
}

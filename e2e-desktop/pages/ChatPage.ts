import { BasePage } from './BasePage'

export class ChatPage extends BasePage {
  get messageInput() {
    return $('[data-testid="chat-input"]')
  }

  get sendButton() {
    return $('[data-testid="send-btn"]')
  }

  get modelSelector() {
    return $('[data-testid="model-selector"]')
  }

  get assistantMessages() {
    return $$('[data-role="assistant"]')
  }

  get userMessages() {
    return $$('[data-role="user"]')
  }

  get streamingIndicator() {
    return $('[data-testid="streaming-indicator"]')
  }

  async sendMessage(text: string): Promise<void> {
    const input = await this.messageInput
    await input.waitForDisplayed({ timeout: 5000 })
    await input.setValue(text)
    await this.sendButton.click()
  }

  async waitForStreamComplete(timeoutMs = 60000): Promise<void> {
    await this.driver.waitUntil(
      async () => {
        const indicator = await $('[data-testid="streaming-indicator"]')
        return !(await indicator.isDisplayed())
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

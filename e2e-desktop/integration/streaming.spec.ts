import { ChatPage } from '../pages/ChatPage.js'

describe('Streaming — real token delivery', () => {
  const chat = new ChatPage()

  before(async () => {
    await chat.waitForAppReady()
    await chat.clickNavIcon('chat')
    await $('[data-testid="chat-input"]').waitForDisplayed({ timeout: 8000 })
  })

  it('streaming indicator appears in DOM while model is generating', async () => {
    const input = await chat.messageInput
    await input.setValue('Count to 5, one number per line.')
    await chat.sendButton.click()
    // streaming-indicator exists in DOM (v-if) but has display:none — use waitForExist
    await $('[data-testid="streaming-indicator"]').waitForExist({ timeout: 10000 })
  })

  it('streaming indicator is removed from DOM when generation is complete', async () => {
    await chat.waitForStreamComplete(60000)
    await $('[data-testid="streaming-indicator"]').waitForExist({
      timeout: 5000,
      reverse: true,
    })
  })

  it('stop generation button works mid-stream', async () => {
    const input = await chat.messageInput
    await input.setValue('Write a 500 word essay about space.')
    await chat.sendButton.click()
    await $('[data-testid="streaming-indicator"]').waitForExist({ timeout: 10000 })
    // send-btn becomes stop button when isStreaming — same element, same testid
    await chat.sendButton.click()
    await browser.waitUntil(
      async () => !(await $('[data-testid="streaming-indicator"]').isExisting()),
      { timeout: 8000, interval: 300 }
    )
  })

  it('response text is readable after stream complete', async () => {
    await chat.sendMessage('Reply: hello')
    await chat.waitForStreamComplete(60000)
    const text = await chat.lastAssistantMessageText()
    expect(text.length).toBeGreaterThan(0)
    expect(text).not.toMatch(/^[A-Za-z0-9+/]+=*$/)
  })
})

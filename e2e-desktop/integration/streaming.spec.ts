import { ChatPage } from '../pages/ChatPage.js'

describe('Streaming — real token delivery', () => {
  const chat = new ChatPage()

  before(async () => {
    await chat.waitForAppReady()
    await chat.clickNavIcon('chat')
    await $('[data-testid="chat-input"]').waitForDisplayed({ timeout: 8000 })
    // Use the same small model as CI to ensure fast, predictable responses
    await chat.selectModel('qwen2:0.5b')
  })

  it('streaming indicator appears in DOM while model is generating', async () => {
    const input = await chat.messageInput
    // Short but multi-token prompt — enough to catch the streaming indicator
    // without making the model generate a long response that risks a timeout.
    await input.setValue('Count from 1 to 5.')
    await chat.sendButton.click()
    // streaming-indicator exists in DOM (v-if) but has display:none — use waitForExist.
    // interval:100 polls every 100ms so even a sub-second stream is caught.
    await $('[data-testid="streaming-indicator"]').waitForExist({ timeout: 10000, interval: 100 })
  })

  it('streaming indicator is removed from DOM when generation is complete', async () => {
    // Allow up to 2 minutes — CI machines can be slow under load.
    await chat.waitForStreamComplete(120000)
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
      { timeout: 15000, interval: 300 }
    )
  })

  it('response text is readable after stream complete', async () => {
    await chat.sendMessage('Say hello to me in a short sentence.')
    // Wait for streaming to START before waiting for it to end, otherwise
    // waitForStreamComplete can resolve immediately (indicator not yet in DOM)
    // and lastAssistantMessageText() returns the previous stale message.
    await $('[data-testid="streaming-indicator"]').waitForExist({ timeout: 15000, interval: 100 })
    await chat.waitForStreamComplete(120000)
    const text = await chat.lastAssistantMessageText()
    expect(text.length).toBeGreaterThan(0)
  })
})

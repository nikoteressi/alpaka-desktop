import { ChatPage } from '../pages/ChatPage.js'

const TEST_MODEL = 'qwen2:0.5b'

describe('Chat — real Ollama integration', () => {
  const chat = new ChatPage()

  before(async () => {
    await chat.waitForAppReady()
    await chat.clickNavIcon('chat')
    await $('[data-testid="chat-input"]').waitForDisplayed({ timeout: 8000 })
  })

  it('model selector shows available models', async () => {
    const selector = await chat.modelSelector
    await selector.waitForDisplayed({ timeout: 5000 })
    await selector.click()
    const option = await $(`[data-testid="model-option-${TEST_MODEL}"]`)
    await option.waitForDisplayed({ timeout: 5000 })
    await option.click()
  })

  it('sends a message and receives a non-empty response', async () => {
    await chat.sendMessage('Say only the word: pong')
    await chat.waitForStreamComplete(60000)
    const response = await chat.lastAssistantMessageText()
    expect(response.trim().length).toBeGreaterThan(0)
  })

  it('assistant response contains expected content', async () => {
    const response = await chat.lastAssistantMessageText()
    expect(response.toLowerCase()).toContain('pong')
  })

  it('user message appears in conversation history', async () => {
    const userMsgs = await chat.userMessages
    expect(userMsgs.length).toBeGreaterThan(0)
    const lastUserText = await userMsgs[userMsgs.length - 1].getText()
    expect(lastUserText).toContain('pong')
  })

  it('can send a follow-up message', async () => {
    await chat.sendMessage('Reply with just the number 42')
    await chat.waitForStreamComplete(60000)
    const response = await chat.lastAssistantMessageText()
    expect(response.trim().length).toBeGreaterThan(0)
  })

  it('conversation has multiple assistant messages after two exchanges', async () => {
    const msgs = await chat.assistantMessages
    expect(msgs.length).toBeGreaterThanOrEqual(2)
  })
})

import { BasePage } from '../pages/BasePage.js'

describe('Navigation', () => {
  const page = new BasePage()

  before(async () => {
    await page.waitForAppReady()
  })

  it('navigates to chat and shows chat input', async () => {
    await page.clickNavIcon('chat')
    await $('[data-testid="chat-input"]').waitForDisplayed({ timeout: 8000 })
  })

  it('navigates to models page', async () => {
    await page.clickNavIcon('models')
    await $('[data-testid="app-root"]').waitForDisplayed({ timeout: 5000 })
  })

  it('navigates to settings and shows general tab', async () => {
    await page.clickNavIcon('settings')
    await $('[data-testid="settings-tab-general"]').waitForDisplayed({ timeout: 8000 })
  })

  it('navigates back to chat and shows chat input again', async () => {
    await page.clickNavIcon('chat')
    await $('[data-testid="chat-input"]').waitForDisplayed({ timeout: 8000 })
  })
})

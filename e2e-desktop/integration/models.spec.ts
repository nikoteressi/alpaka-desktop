import { ModelsPage } from '../pages/ModelsPage.js'

describe('Models Page — real Ollama integration', () => {
  const models = new ModelsPage()

  before(async () => {
    await models.waitForAppReady()
    await models.clickNavIcon('models')
    await browser.pause(1000)
  })

  it('loaded models tab shows at least one installed model', async () => {
    await browser.waitUntil(
      async () => (await models.modelCards).length > 0,
      { timeout: 10000, interval: 500 }
    )
    expect((await models.modelCards).length).toBeGreaterThan(0)
  })

  it('each model card is displayed', async () => {
    const cards = await models.modelCards
    for (const card of cards) {
      await expect(card).toBeDisplayed()
    }
  })

  it('library tab is accessible', async () => {
    await models.navigateToLibrary()
    await $('[data-testid="app-root"]').waitForDisplayed({ timeout: 5000 })
  })
})

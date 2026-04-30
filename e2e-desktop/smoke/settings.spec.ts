import { SettingsPage } from '../pages/SettingsPage.js'

describe('Settings Page', () => {
  const page = new SettingsPage()

  before(async () => {
    await page.waitForAppReady()
    await page.clickNavIcon('settings')
    await $('[data-testid="settings-tab-general"]').waitForDisplayed({ timeout: 8000 })
  })

  it('general tab is active by default', async () => {
    const active = await page.getActiveTab()
    expect(active).toBe('general')
  })

  it('can switch to connectivity tab', async () => {
    await page.openTab('connectivity')
    const active = await page.getActiveTab()
    expect(active).toBe('connectivity')
  })

  it('can switch to engine (models) tab', async () => {
    await page.openTab('models')
    const active = await page.getActiveTab()
    expect(active).toBe('models')
  })

  it('can switch to advanced tab', async () => {
    await page.openTab('advanced')
    const active = await page.getActiveTab()
    expect(active).toBe('advanced')
  })

  it('mirostat selector is present on engine tab', async () => {
    await page.openTab('models')
    const mirostat = await $('[data-testid="mirostat-selector"]')
    await expect(mirostat).toBeDisplayed()
  })
})

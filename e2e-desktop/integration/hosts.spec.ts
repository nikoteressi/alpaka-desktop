import { SettingsPage } from '../pages/SettingsPage.js'

describe('Hosts — connectivity management', () => {
  const settings = new SettingsPage()

  before(async () => {
    await settings.waitForAppReady()
    await settings.clickNavIcon('settings')
    await $('[data-testid="settings-tab-connectivity"]').waitForDisplayed({ timeout: 5000 })
    await $('[data-testid="settings-tab-connectivity"]').click()
    await browser.pause(300)
    // Expand the Ollama Hosts panel if not already expanded
    const hostStatus = await $('[data-testid="host-status"]')
    if (!(await hostStatus.isExisting())) {
      const expandBtn = await $('[data-testid="hosts-expand-btn"]')
      if (await expandBtn.isExisting()) {
        await expandBtn.click()
      }
    }
    // Wait until the host list is visible
    await $('[data-testid="host-status"]').waitForExist({ timeout: 5000 })
  })

  it('connectivity settings tab is visible', async () => {
    const tab = await $('[data-testid="settings-tab-connectivity"]')
    await expect(tab).toBeDisplayed()
  })

  it('default host is configured with local Ollama URL', async () => {
    // The binary seeds a "Local" host (http://localhost:11434) on first startup.
    // In test-mode the health-loop is disabled so the status dot stays gray — check URL.
    // WebKit/WRY getText() returns "" for overflow:hidden (truncate) elements, so we
    // search the full DOM textContent for the URL string instead.
    const found = await browser.waitUntil(
      async () =>
        (await browser.execute(() => document.body.textContent?.includes('localhost:11434') ?? false)) === true,
      { timeout: 5000, interval: 300 }
    )
    expect(found).toBe(true)
  })

  it('at least one host is listed', async () => {
    const hostStatuses = await $$('[data-testid="host-status"]')
    expect(hostStatuses.length).toBeGreaterThan(0)
  })
})

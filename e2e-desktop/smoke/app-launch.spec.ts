describe('App Launch', () => {
  it('app window appears and root element is visible', async () => {
    await $('[data-testid="app-root"]').waitForDisplayed({ timeout: 15000 })
  })

  it('window has correct title', async () => {
    const title = await browser.getTitle()
    expect(title).toContain('Alpaka')
  })

  it('navigation icon strip is visible', async () => {
    const sidebarToggle = await $('[data-testid="sidebar-toggle"]')
    await expect(sidebarToggle).toBeDisplayed()
  })

  it('app does not show an error screen on cold start', async () => {
    const errorEl = await $('[data-testid="error-screen"]')
    await expect(errorEl).not.toBeExisting()
  })
})

import { BasePage } from './BasePage.js'

export class SettingsPage extends BasePage {
  async getActiveTab(): Promise<string> {
    const tabs = await $$('[data-testid^="settings-tab-"]')
    for (const tab of tabs) {
      const classes = await tab.getAttribute('class')
      if (classes?.includes('app-tab--active')) {
        const testId = await tab.getAttribute('data-testid')
        return testId?.replace('settings-tab-', '') ?? ''
      }
    }
    return ''
  }

  async getMirostatValue(): Promise<0 | 1 | 2> {
    const buttons = await $$('[data-testid="mirostat-selector"] button')
    for (const btn of buttons) {
      const classes = await btn.getAttribute('class')
      if (classes?.includes('bg-[var(--accent)]')) {
        const text = await btn.getText()
        if (text === 'Mirostat 1') return 1
        if (text === 'Mirostat 2') return 2
      }
    }
    return 0
  }
}

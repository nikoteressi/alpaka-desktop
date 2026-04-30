import { BasePage } from './BasePage'

type SettingsTab = 'general' | 'connectivity' | 'models' | 'prompts' | 'account' | 'maintenance' | 'advanced'

export class SettingsPage extends BasePage {
  async openSettingsTab(tab: SettingsTab): Promise<void> {
    await this.openTab(tab)
  }

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

  async getMirostatValue(): Promise<string> {
    const selector = await $('[data-testid="mirostat-selector"]')
    return selector.getValue()
  }
}

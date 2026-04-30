import { BasePage } from './BasePage'

type SettingsTab = 'general' | 'connectivity' | 'models' | 'prompts' | 'account' | 'maintenance' | 'advanced'

export class SettingsPage extends BasePage {
  async openSettingsTab(tab: SettingsTab): Promise<void> {
    await this.openTab(tab)
  }

  async getActiveTab(): Promise<string> {
    const active = await $('.app-tab--active')
    const testId = await active.getAttribute('data-testid')
    return testId?.replace('settings-tab-', '') ?? ''
  }

  async getMirostatValue(): Promise<string> {
    const selector = await $('[data-testid="mirostat-selector"]')
    return selector.getValue()
  }
}

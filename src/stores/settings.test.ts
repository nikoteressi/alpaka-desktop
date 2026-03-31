import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useSettingsStore } from './settings'

const mockInvoke = vi.fn()
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (cmd: string, args: any) => mockInvoke(cmd, args)
}))

describe('useSettingsStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockInvoke.mockReset()
  })

  it('initialize loads all settings including complex objects', async () => {
    const settingsStore = useSettingsStore()
    const mockSettings = {
      theme: 'dark',
      fontSize: '16',
      compactMode: 'true',
      chatOptions: JSON.stringify({ temperature: 0.5 })
    }
    
    mockInvoke.mockResolvedValue(mockSettings)

    await settingsStore.initialize()

    expect(mockInvoke).toHaveBeenCalledWith('get_all_settings', undefined)
    expect(settingsStore.theme).toBe('dark')
    expect(settingsStore.fontSize).toBe(16)
    expect(settingsStore.compactMode).toBe(true)
    expect(settingsStore.chatOptions.temperature).toBe(0.5)
    // Should keep defaults for missing properties
    expect(settingsStore.chatOptions.top_p).toBe(0.9)
  })

  it('updateSetting calls invoke with JSON string for complex values', async () => {
    const settingsStore = useSettingsStore()
    
    mockInvoke.mockResolvedValue(null)

    await settingsStore.updateSetting('chatOptions', { temperature: 0.8 })

    expect(mockInvoke).toHaveBeenCalledWith('set_setting', {
      key: 'chatOptions',
      value: JSON.stringify({ temperature: 0.8 })
    })
    expect(settingsStore.chatOptions).toEqual({ temperature: 0.8 })
  })

  it('updateChatOptions merges options and saves', async () => {
    const settingsStore = useSettingsStore()
    settingsStore.chatOptions = { temperature: 0.7, top_p: 0.9 } as any
    
    mockInvoke.mockResolvedValue(null)

    await settingsStore.updateChatOptions({ temperature: 1.0 })

    expect(settingsStore.chatOptions.temperature).toBe(1.0)
    expect(settingsStore.chatOptions.top_p).toBe(0.9)
    expect(mockInvoke).toHaveBeenCalledWith('set_setting', {
      key: 'chatOptions',
      value: JSON.stringify(settingsStore.chatOptions)
    })
  })
})

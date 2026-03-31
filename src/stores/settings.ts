import { defineStore } from 'pinia';
import { invoke } from '@tauri-apps/api/core';
import type { SettingsState, ColorTheme, ChatOptions } from '../types/settings';

const DEFAULT_CHAT_OPTIONS: ChatOptions = {
  temperature: 0.7,
  top_p: 0.9,
  top_k: 40,
  num_ctx: 4096,
  repeat_penalty: 1.1,
  repeat_last_n: 64,
};

export const useSettingsStore = defineStore('settings', {
  state: (): SettingsState => ({
    theme: 'system',
    apiKeys: {},
    activeHostId: null,
    sidebarCollapsed: false,
    fontSize: 14,
    compactMode: false,
    chatOptions: { ...DEFAULT_CHAT_OPTIONS },
  }),

  actions: {
    async initialize() {
      try {
        const allSettings = await invoke<Record<string, string>>('get_all_settings');
        
        if (allSettings.theme) {
          this.theme = allSettings.theme as ColorTheme;
        }
        if (allSettings.sidebarCollapsed) {
          this.sidebarCollapsed = allSettings.sidebarCollapsed === 'true';
        }
        if (allSettings.fontSize) {
          this.fontSize = parseInt(allSettings.fontSize, 10) || 14;
        }
        if (allSettings.activeHostId) {
          this.activeHostId = allSettings.activeHostId;
        }
        if (allSettings.compactMode) {
          this.compactMode = allSettings.compactMode === 'true';
        }
        if (allSettings.apiKeys) {
            try {
                this.apiKeys = JSON.parse(allSettings.apiKeys);
            } catch (e) {
                console.error('Failed to parse apiKeys setting:', e);
            }
        }
        if (allSettings.chatOptions) {
          try {
            this.chatOptions = { 
              ...DEFAULT_CHAT_OPTIONS, 
              ...JSON.parse(allSettings.chatOptions) 
            };
          } catch (e) {
            console.error('Failed to parse chatOptions setting:', e);
          }
        }
        
        this.applyTheme();
      } catch (error) {
        console.error('Failed to initialize settings:', error);
      }
    },

    async updateSetting(key: keyof SettingsState, value: any) {
      // Optimistic update
      (this as any)[key] = value;

      try {
        await invoke('set_setting', { 
          key, 
          value: typeof value === 'string' ? value : JSON.stringify(value) 
        });

        if (key === 'theme') {
          this.applyTheme();
        }
      } catch (error) {
        console.error(`Failed to update setting ${key}:`, error);
      }
    },

    async updateChatOptions(options: Partial<ChatOptions>) {
      this.chatOptions = { ...this.chatOptions, ...options };
      await this.updateSetting('chatOptions', this.chatOptions);
    },

    applyTheme() {
      const theme = this.theme;
      const root = document.documentElement;
      
      if (theme === 'system') {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        root.classList.toggle('dark', prefersDark);
      } else {
        root.classList.toggle('dark', theme === 'dark');
      }
    },

    setTheme(theme: ColorTheme) {
      this.updateSetting('theme', theme);
    }
  }
});

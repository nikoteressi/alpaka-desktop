export type ColorTheme = 'light' | 'dark' | 'system';

export interface ChatOptions {
  temperature: number;
  top_p: number;
  top_k: number;
  num_ctx: number;
  repeat_penalty: number;
  repeat_last_n: number;
  seed?: number;
  stop?: string[];
}

export interface SettingsState {
  theme: ColorTheme;
  apiKeys: Record<string, string>; // host_id -> key
  activeHostId: string | null;
  sidebarCollapsed: boolean;
  fontSize: number;
  compactMode: boolean;
  chatOptions: ChatOptions;
}

export interface AppSettings {
  [key: string]: string;
}

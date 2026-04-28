export type ColorTheme = "light" | "dark" | "system";

export interface ChatOptions {
  temperature?: number;
  top_p?: number;
  top_k?: number;
  num_ctx?: number;
  repeat_penalty?: number;
  repeat_last_n?: number;
  seed?: number;
  stop?: string[];
}

export interface SettingsState {
  theme: ColorTheme;
  sidebarCollapsed: boolean;
  fontSize: number;
  compactMode: boolean;
  chatOptions: Required<Omit<ChatOptions, "seed" | "stop">> & ChatOptions;
  cloud: boolean;
  autoUpdate: boolean;
  exposeNetwork: boolean;
  modelPath: string;
  serverUrl: string;
  showPerformanceMetrics: boolean;
  notificationsEnabled: boolean;
  globalSystemPrompt: string;
  systemFormattingEnabled: boolean;
  systemFormattingTemplate: string;
  systemSearchTemplate: string;
  systemFolderTemplate: string;
}

export interface AppSettings {
  [key: string]: string;
}

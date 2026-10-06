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
  mirostat?: 0 | 1 | 2;
  mirostat_tau?: number;
  mirostat_eta?: number;
  num_gpu?: number;
}

export type PresetOptions = Required<
  Pick<
    ChatOptions,
    | "temperature"
    | "top_p"
    | "top_k"
    | "num_ctx"
    | "repeat_penalty"
    | "repeat_last_n"
  >
> & {
  mirostat?: 0 | 1 | 2;
  mirostat_tau?: number;
  mirostat_eta?: number;
};

export interface Preset {
  id: string;
  name: string;
  isBuiltin: boolean;
  options: PresetOptions;
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
  presets: Preset[];
  defaultPresetId: string;
  compactionModel: string; // "" means "same as conversation model"
}

export interface AppSettings {
  [key: string]: string;
}

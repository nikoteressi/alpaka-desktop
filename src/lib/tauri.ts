import { invoke } from "@tauri-apps/api/core";
import type {
  BackendMessage,
  Conversation,
  FolderContextPayload,
} from "../types/chat";
import type {
  Model,
  ModelCapabilities,
  LibraryModel,
  LaunchApp,
} from "../types/models";
import type { SettingsState, ChatOptions } from "../types/settings";

// ── Error utilities ───────────────────────────────────────────────────────────

export function extractErrorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

// ── Host types ────────────────────────────────────────────────────────────────

export interface Host {
  id: string;
  name: string;
  url: string;
  is_active: boolean;
  status: "online" | "offline" | "unknown";
  created_at: string;
}

export interface NewHost {
  name: string;
  url: string;
}

// ── Auth types ─────────────────────────────────────────────────────────────────

export interface AuthStatus {
  authenticated: boolean;
  username: string | null;
}

// ── Typed IPC wrappers ────────────────────────────────────────────────────────

export const tauriApi = {
  // Chat
  getMessages: (conversationId: string) =>
    invoke<BackendMessage[]>("get_messages", { conversationId }),

  listConversations: (limit: number, offset: number) =>
    invoke<Conversation[]>("list_conversations", { limit, offset }),

  createConversation: (
    model: string,
    title: string | null = null,
    systemPrompt: string | null = null,
  ) =>
    invoke<Conversation>("create_conversation", { model, title, systemPrompt }),

  updateConversationTitle: (conversationId: string, title: string) =>
    invoke<void>("update_conversation_title", { conversationId, title }),

  updateConversationModel: (conversationId: string, model: string) =>
    invoke<void>("update_conversation_model", { conversationId, model }),

  updateConversationSettings: (conversationId: string, settings: ChatOptions) =>
    invoke<void>("update_conversation_settings", { conversationId, settings }),

  setConversationPinned: (conversationId: string, pinned: boolean) =>
    invoke<void>("set_conversation_pinned", { conversationId, pinned }),

  updateSystemPrompt: (conversationId: string, systemPrompt: string) =>
    invoke<void>("update_system_prompt", { conversationId, systemPrompt }),

  deleteConversation: (conversationId: string) =>
    invoke<void>("delete_conversation", { conversationId }),

  sendMessage: (params: {
    conversationId: string;
    content: string;
    images: number[][] | Uint8Array[] | null;
    model: string;
    folderContext: string | null;
    webSearchEnabled?: boolean | null;
    thinkMode?: string | null;
  }) => invoke<void>("send_message", params),

  stopGeneration: () => invoke<void>("stop_generation"),

  exportConversation: (conversationId: string) =>
    invoke<void>("export_conversation", { conversationId }),

  backupDatabase: () => invoke<void>("backup_database"),

  // Models
  listModels: () => invoke<Model[]>("list_models"),

  deleteModel: (name: string) => invoke<void>("delete_model", { name }),

  pullModel: (name: string) => invoke<void>("pull_model", { name }),

  getModelCapabilities: (name: string) =>
    invoke<ModelCapabilities>("get_model_capabilities", { name }),

  getModelDefaults: (modelName: string) =>
    invoke<Partial<ChatOptions> | null>("get_model_defaults", { modelName }),

  setModelDefaults: (modelName: string, defaults: Partial<ChatOptions>) =>
    invoke<void>("set_model_defaults", { modelName, defaults }),

  searchOllamaLibrary: (query: string) =>
    invoke<LibraryModel[]>("search_ollama_library", { query }),

  // Hosts
  listHosts: () => invoke<Host[]>("list_hosts"),

  addHost: (host: NewHost) => invoke<Host>("add_host", { host }),

  addHostWithDefault: (name: string, url: string, isDefault: boolean = false) =>
    invoke<Host>("add_host", { newHost: { name, url, is_default: isDefault } }),

  updateHost: (host: Host) => invoke<Host>("update_host", { host }),

  updateHostFields: (id: string, name: string, url: string) =>
    invoke<void>("update_host", { id, name, url }),

  deleteHost: (id: string) => invoke<void>("delete_host", { id }),

  setActiveHost: (id: string) => invoke<void>("set_active_host", { id }),

  pingHost: (id: string) => invoke<boolean>("ping_host", { id }),

  // Settings
  getAllSettings: () => invoke<Record<string, string>>("get_all_settings"),

  getSetting: (key: string) => invoke<string | null>("get_setting", { key }),

  setSetting: (key: keyof SettingsState, value: string) =>
    invoke<void>("set_setting", { key, value }),

  deleteSetting: (key: string) => invoke<void>("delete_setting", { key }),

  // Auth
  login: (token: string) => invoke<void>("login", { token }),

  loginWithHost: (hostId: string, token: string) =>
    invoke<void>("login", { hostId, token }),

  logout: () => invoke<void>("logout"),

  logoutHost: (hostId: string) => invoke<void>("logout", { hostId }),

  getAuthStatus: () => invoke<AuthStatus>("get_auth_status"),

  getHostAuthStatus: (hostId: string) =>
    invoke<boolean>("get_auth_status", { hostId }),

  checkOllamaSignedIn: () => invoke<boolean>("check_ollama_signed_in"),

  // Service
  startOllama: () => invoke<void>("start_ollama"),

  stopOllama: () => invoke<void>("stop_ollama"),

  ollamaServiceStatus: () => invoke<string>("ollama_service_status"),

  // Folders
  linkFolder: (conversationId: string, path: string) =>
    invoke<{
      id: string;
      path: string;
      content: string;
      token_estimate: number;
    }>("link_folder", { conversationId, path }),

  unlinkFolder: (id: string) => invoke<void>("unlink_folder", { id }),

  getFolderContexts: (conversationId: string) =>
    invoke<FolderContextPayload[]>("get_folder_contexts", { conversationId }),

  listFolderFiles: (path: string) =>
    invoke<string[]>("list_folder_files", { path }),

  updateIncludedFiles: (folderId: string, includedFiles: string[]) =>
    invoke<void>("update_included_files", { folderId, includedFiles }),

  estimateTokens: (folderId: string) =>
    invoke<number>("estimate_tokens", { folderId }),

  // System
  reportActiveView: (isChatView: boolean, conversationId: string | null) =>
    invoke<void>("report_active_view", { isChatView, conversationId }),

  openBrowser: (url: string) => invoke<void>("open_browser", { url }),

  getLibraryModelDetails: (slug: string) =>
    invoke<{ readme: string; launch_apps: LaunchApp[] }>(
      "get_library_model_readme",
      { slug },
    ),
};

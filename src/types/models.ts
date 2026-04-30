// ---- Branded Types for Nominal Typing ----
export type Brand<T, K> = T & { __brand: K };
export type ModelName = Brand<string, "ModelName">;
export type ModelSlug = Brand<string, "ModelSlug">;

export interface ModelDetails {
  parent_model: string;
  format: string;
  family: string;
  families: string[] | null;
  parameter_size: string;
  quantization_level: string;
}

export interface Model {
  name: ModelName;
  model: string;
  modified_at: string;
  size: number;
  digest: string;
  details: ModelDetails;
}

export interface PullProgressPayload {
  model: string;
  status: string;
  completed?: number;
  total?: number;
  percent: number;
}

export interface LibraryTag {
  name: string;
  size: string;
  hash: string;
  updated_at: string;
  context?: string;
  input?: string;
}

export interface LaunchApp {
  name: string;
  command: string;
  icon_url: string;
}

export interface LibraryModel {
  name: string;
  slug: string;
  description: string;
  tags: string[];
  pull_count?: string;
  updated_at?: string;
  tag_count?: string;
  readme?: string;
  launch_apps?: LaunchApp[];
}

export interface HardwareInfo {
  gpu_name?: string;
  vram_mb?: number;
  ram_mb: number;
}

export interface ModelCapabilities {
  name: ModelName;
  thinking: boolean;
  thinking_toggleable: boolean;
  thinking_levels: string[];
  tools: boolean;
  vision: boolean;
  embedding: boolean;
  audio: boolean;
  cloud: boolean;
  context_length?: number;
}

export interface PullHistoryEntry {
  id: number;
  model_name: ModelName;
  status: string;
  error_message?: string;
  started_at: string;
  finished_at?: string;
}

export interface ModelUserData {
  name: string;
  isFavorite: boolean;
  tags: string[];
}

export interface CreateProgressPayload {
  model: string;
  status: string;
}

export interface CreateDonePayload {
  model: string;
}

export interface CreateErrorPayload {
  model: string;
  error: string;
  cancelled: boolean;
}

export interface CreateState {
  name: string;
  modelfile: string;
  status: string;
  phase: "running" | "done" | "error" | "cancelled";
  error?: string;
  logLines: string[];
}

export interface UserProfile {
  id: string;
  username: string;
  email?: string;
  avatar_url?: string;
}

export type ApiKeyStatus =
  | "not_set"
  | "set"
  | "valid"
  | "invalid"
  | "checking"
  | "unknown";

export interface AuthState {
  user: UserProfile | null;
  authenticatedHosts: Record<string, boolean>;
  apiKeyStatus: ApiKeyStatus;
  isCheckingStatus: boolean;
}

export interface LoginPayload {
  host_id: string;
  token: string;
}

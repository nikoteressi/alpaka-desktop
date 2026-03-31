export interface UserProfile {
  id: string;
  username: string;
  email?: string;
  avatar_url?: string;
}

export interface ApiKey {
  id: string;
  name: string;
  key: string; // masked in UI, plaintext from backend on create
  created_at: string;
}

export interface AuthState {
  user: UserProfile | null;
  authenticatedHosts: Record<string, boolean>; // host_id -> is_authenticated
  apiKeys: ApiKey[];
}

export interface LoginPayload {
  host_id: string;
  token: string;
}

import { defineStore } from "pinia";
import { invoke } from "@tauri-apps/api/core";
import type { AuthState, ApiKeyStatus } from "../types/auth";

export const useAuthStore = defineStore("auth", {
  state: (): AuthState => ({
    user: null,
    authenticatedHosts: {},
    apiKeyStatus: "unknown" as ApiKeyStatus,
    isCheckingStatus: false,
  }),

  actions: {
    async checkAuthStatus(hostId: string): Promise<boolean> {
      this.isCheckingStatus = true;
      try {
        const isAuthenticated = await invoke<boolean>("get_auth_status", {
          hostId,
        });
        this.authenticatedHosts[hostId] = isAuthenticated;
        if (isAuthenticated) {
          if (!this.user) {
            this.user = { id: hostId, username: "" };
          }
          this.fetchOllamaUserProfile().catch(() => {});
        } else if (Object.values(this.authenticatedHosts).every((v) => !v)) {
          this.user = null;
        }
        return isAuthenticated;
      } catch (error) {
        console.error(`Failed to check auth status for host ${hostId}:`, error);
        return false;
      } finally {
        this.isCheckingStatus = false;
      }
    },

    async fetchOllamaUserProfile(): Promise<void> {
      try {
        const profile = await invoke<{
          name: string;
          email?: string;
          plan?: string;
        }>("get_ollama_user_profile");
        if (this.user) {
          this.user.username = profile.name;
          this.user.email = profile.email;
        } else {
          this.user = {
            id: "ollama-cloud",
            username: profile.name,
            email: profile.email,
          };
        }
      } catch (err) {
        console.warn("Could not fetch Ollama user profile:", err);
      }
    },

    async checkOllamaSignedIn(): Promise<boolean> {
      try {
        return await invoke<boolean>("check_ollama_signed_in");
      } catch {
        return false;
      }
    },

    async login(hostId: string, token: string) {
      try {
        await invoke("login", { hostId, token });
        await this.checkAuthStatus(hostId);
      } catch (error) {
        console.error(`Login failed for host ${hostId}:`, error);
        throw error;
      }
    },

    async logout(hostId: string) {
      try {
        await invoke("logout", { hostId });
        this.authenticatedHosts[hostId] = false;
        if (Object.values(this.authenticatedHosts).every((v) => !v)) {
          this.user = null;
        }
      } catch (error) {
        console.error(`Logout failed for host ${hostId}:`, error);
        throw error;
      }
    },

    async loadApiKeyStatus() {
      try {
        const status = await invoke<string>("get_api_key_status");
        this.apiKeyStatus = status as ApiKeyStatus;
      } catch {
        this.apiKeyStatus = "unknown";
      }
    },

    async saveApiKey(key: string) {
      await invoke("set_api_key", { key });
      this.apiKeyStatus = "set";
    },

    async removeApiKey() {
      await invoke("delete_api_key");
      this.apiKeyStatus = "not_set";
    },

    async validateApiKey(hostId: string): Promise<boolean> {
      this.apiKeyStatus = "checking";
      try {
        const valid = await invoke<boolean>("validate_api_key", { hostId });
        this.apiKeyStatus = valid ? "valid" : "invalid";
        return valid;
      } catch {
        this.apiKeyStatus = "unknown";
        return false;
      }
    },

    isHostAuthenticated(hostId: string): boolean {
      return !!this.authenticatedHosts[hostId];
    },
  },
});

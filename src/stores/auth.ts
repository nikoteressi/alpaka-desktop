import { defineStore } from 'pinia';
import { invoke } from '@tauri-apps/api/core';
import type { AuthState } from '../types/auth';

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    user: null,
    authenticatedHosts: {},
    apiKeys: [],
  }),

  actions: {
    async checkAuthStatus(hostId: string): Promise<boolean> {
      try {
        const isAuthenticated = await invoke<boolean>('get_auth_status', { hostId });
        this.authenticatedHosts[hostId] = isAuthenticated;
        return isAuthenticated;
      } catch (error) {
        console.error(`Failed to check auth status for host ${hostId}:`, error);
        return false;
      }
    },

    async login(hostId: string, token: string) {
      try {
        await invoke('login', { hostId, token });
        // Since backend login currently returns void, we manually trigger a status check
        await this.checkAuthStatus(hostId);
        
        // Mock user profile for now if authenticated, as backend doesn't return user yet
        if (this.authenticatedHosts[hostId]) {
          this.user = {
            id: 'local-user',
            username: 'Ollama User',
          };
        }
      } catch (error) {
        console.error(`Login failed for host ${hostId}:`, error);
        throw error;
      }
    },

    async logout(hostId: string) {
      try {
        await invoke('logout', { hostId });
        this.authenticatedHosts[hostId] = false;
        if (Object.values(this.authenticatedHosts).every(v => !v)) {
          this.user = null;
        }
      } catch (error) {
        console.error(`Logout failed for host ${hostId}:`, error);
        throw error;
      }
    },

    // API Key management is currently placeholder until backend supports it
    async fetchApiKeys() {
      console.warn('fetchApiKeys is not yet implemented in backend');
    },

    async createApiKey(_name: string) {
      console.warn('createApiKey is not yet implemented in backend');
      throw new Error('Not implemented');
    },

    async revokeApiKey(_id: string) {
      console.warn('revokeApiKey is not yet implemented in backend');
      throw new Error('Not implemented');
    },

    isHostAuthenticated(hostId: string): boolean {
      return !!this.authenticatedHosts[hostId];
    }
  }
});

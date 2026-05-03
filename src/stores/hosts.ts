import { defineStore } from "pinia";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { Host, HostStatusChangePayload } from "../types/hosts";

export const useHostStore = defineStore("hosts", {
  state: () => ({
    hosts: [] as Host[],
    activeHostId: null as string | null,
    isHostManagerOpen: false,
    listenersInitialized: false,
    _unlisten: null as (() => void) | null,
  }),
  getters: {
    activeHost: (state) =>
      state.hosts.find((h) => h.id === state.activeHostId) || null,
  },
  actions: {
    async fetchHosts() {
      try {
        const fetchedHosts = await invoke<Host[]>("list_hosts");
        this.hosts = fetchedHosts;
        const active = fetchedHosts.find((h) => h.is_active);
        if (active) {
          this.activeHostId = active.id;
        }
      } catch (e) {
        console.error("Failed to fetch hosts", e);
      }
    },
    async setActiveHost(id: string) {
      if (this.activeHostId === id) return;

      try {
        await invoke("set_active_host", { id });
        this.activeHostId = id;
        await this.fetchHosts(); // Refresh state
      } catch (e) {
        console.error("Failed to switch host", e);
      }
    },
    async addHost(name: string, url: string, is_default: boolean = false) {
      try {
        await invoke("add_host", { newHost: { name, url, is_default } });
        await this.fetchHosts();
      } catch (e) {
        console.error("Failed to add host", e);
      }
    },
    async updateHost(id: string, name: string, url: string) {
      try {
        await invoke("update_host", { id, name, url });
        await this.fetchHosts();
      } catch (e) {
        console.error("Failed to update host", e);
      }
    },
    async deleteHost(id: string) {
      // Must not delete active host without warning, handle logic in component
      try {
        await invoke("delete_host", { id });
        await this.fetchHosts();
      } catch (e) {
        console.error("Failed to delete host", e);
      }
    },
    async initListeners() {
      if (this.listenersInitialized) return;
      const unlisten = await listen<HostStatusChangePayload>(
        "host:status-change",
        (event) => {
          const payload = event.payload;
          const hostIndex = this.hosts.findIndex(
            (h) => h.id === payload.host_id,
          );
          const host = this.hosts[hostIndex];
          if (host) {
            this.hosts[hostIndex] = {
              ...host,
              last_ping_status: payload.status,
              last_ping_at: new Date().toISOString(),
            };
          }
        },
      );
      this._unlisten = unlisten;
      this.listenersInitialized = true;
    },
  },
});

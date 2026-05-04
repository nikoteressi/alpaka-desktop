<template>
  <div class="settings-card gap-3">
    <div>
      <p class="text-[13.5px] font-bold text-[var(--text)]">
        HTTP / SOCKS5 Proxy
      </p>
      <p class="text-[12px] text-[var(--text-dim)] mt-0.5">
        Route Ollama API traffic through a proxy. Leave blank to connect
        directly.
      </p>
    </div>

    <div class="flex flex-col gap-2">
      <div class="flex items-center gap-2">
        <span class="text-[12px] text-[var(--text-dim)] w-24 flex-shrink-0"
          >Proxy URL</span
        >
        <input
          v-model="proxyUrl"
          placeholder="http://proxy:3128  or  socks5://proxy:1080"
          class="custom-input flex-1 font-mono text-[12px]"
        />
      </div>

      <div class="flex items-center gap-2">
        <span class="text-[12px] text-[var(--text-dim)] w-24 flex-shrink-0"
          >Username</span
        >
        <input
          v-model="username"
          placeholder="optional"
          class="custom-input flex-1"
        />
      </div>

      <div class="flex items-center gap-2">
        <span class="text-[12px] text-[var(--text-dim)] w-24 flex-shrink-0"
          >Password</span
        >
        <input
          type="password"
          v-model="password"
          :placeholder="hasPassword ? '••••••••' : 'optional'"
          class="custom-input flex-1"
        />
      </div>
    </div>

    <div class="flex items-center gap-2 flex-wrap">
      <button
        @click="saveProxy"
        :disabled="isSaving"
        class="px-3 py-1.5 bg-[var(--accent)] hover:bg-[var(--accent-hover)] rounded-lg text-white text-[12px] font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {{ isSaving ? "Saving…" : "Save" }}
      </button>

      <button
        @click="testProxy"
        :disabled="isTesting || !proxyUrl.trim()"
        class="px-3 py-1.5 bg-[var(--bg-hover)] border border-[var(--border-strong)] rounded-lg text-[var(--text)] text-[12px] cursor-pointer hover:bg-[var(--bg-active)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {{ isTesting ? "Testing…" : "Test proxy" }}
      </button>

      <button
        v-if="hasSavedProxy"
        @click="clearProxy"
        class="px-3 py-1.5 bg-[var(--danger)]/10 border border-[var(--danger)]/20 rounded-lg text-[var(--danger)] text-[12px] font-bold cursor-pointer hover:bg-[var(--danger)] hover:text-white transition-all"
      >
        Clear
      </button>

      <span
        v-if="testResult"
        :class="testResult.success ? 'text-green-500' : 'text-[var(--danger)]'"
        class="text-[12px]"
      >
        {{ testResult.message }}
      </span>
    </div>

    <p v-if="errorMsg" class="text-[11px] text-[var(--danger)]">
      {{ errorMsg }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { invoke } from "@tauri-apps/api/core";

interface ProxyConfig {
  proxy_url: string;
  username: string;
  has_password: boolean;
}

interface ProxyTestResult {
  success: boolean;
  message: string;
}

const proxyUrl = ref("");
const username = ref("");
const password = ref("");
const hasPassword = ref(false);
const isSaving = ref(false);
const isTesting = ref(false);
const testResult = ref<ProxyTestResult | null>(null);
const errorMsg = ref("");

const hasSavedProxy = computed(
  () => proxyUrl.value.trim() !== "" || hasPassword.value,
);

onMounted(async () => {
  try {
    const config = await invoke<ProxyConfig>("get_proxy_config");
    proxyUrl.value = config.proxy_url;
    username.value = config.username;
    hasPassword.value = config.has_password;
  } catch (e) {
    console.error("Failed to load proxy config:", e);
  }
});

async function saveProxy() {
  isSaving.value = true;
  errorMsg.value = "";
  testResult.value = null;
  try {
    await invoke("save_proxy", {
      proxyUrl: proxyUrl.value,
      username: username.value,
      password: password.value,
    });
    if (password.value !== "") {
      hasPassword.value = true;
    }
    password.value = "";
  } catch (e: unknown) {
    errorMsg.value = extractMessage(e);
  } finally {
    isSaving.value = false;
  }
}

async function testProxy() {
  isTesting.value = true;
  testResult.value = null;
  errorMsg.value = "";
  try {
    testResult.value = await invoke<ProxyTestResult>("test_proxy", {
      proxyUrl: proxyUrl.value,
      username: username.value,
      password: password.value,
    });
  } catch (e: unknown) {
    errorMsg.value = extractMessage(e);
  } finally {
    isTesting.value = false;
  }
}

async function clearProxy() {
  errorMsg.value = "";
  testResult.value = null;
  try {
    await invoke("delete_proxy");
    proxyUrl.value = "";
    username.value = "";
    password.value = "";
    hasPassword.value = false;
  } catch (e: unknown) {
    errorMsg.value = extractMessage(e);
  }
}

function extractMessage(e: unknown): string {
  if (typeof e === "string") return e;
  if (typeof e === "object" && e !== null) {
    const vals = Object.values(e);
    if (vals.length > 0) return String(vals[0]);
  }
  return "An unexpected error occurred.";
}
</script>

<style scoped>
.settings-card {
  padding: 14px 16px;
  border-radius: 12px;
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  display: flex;
  flex-direction: column;
}
</style>

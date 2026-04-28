<template>
  <div class="settings-card">
    <div class="flex items-start justify-between gap-3 mb-3">
      <div>
        <p class="text-[13.5px] font-bold text-[var(--text)]">API Key</p>
        <p class="text-[12px] mt-0.5 text-[var(--text-dim)]">
          Alternative to browser sign-in. Generate a key at ollama.com/settings.
        </p>
      </div>
      <span
        :class="statusBadgeClass"
        class="text-[11px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 mt-0.5"
      >
        {{ statusLabel }}
      </span>
    </div>

    <!-- Input row -->
    <div class="flex gap-2">
      <div class="relative flex-1">
        <input
          v-model="keyInput"
          :type="showKey ? 'text' : 'password'"
          placeholder="Paste your Ollama API key..."
          :disabled="isBusy"
          class="custom-input w-full pr-9"
          @keydown.enter="handleSave"
        />
        <button
          type="button"
          @click="showKey = !showKey"
          class="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-dim)] hover:text-[var(--text)] transition-colors"
        >
          <!-- Eye-off icon (visible when showing key) -->
          <svg
            v-if="showKey"
            class="w-3.5 h-3.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path
              d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"
            />
            <path
              d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"
            />
            <line x1="1" y1="1" x2="23" y2="23" />
          </svg>
          <!-- Eye icon (visible when hiding key) -->
          <svg
            v-else
            class="w-3.5 h-3.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </button>
      </div>
      <button
        @click="handleSave"
        :disabled="!keyInput.trim() || isBusy"
        class="px-3 py-1.5 bg-[var(--accent)] hover:bg-[var(--accent-hover)] rounded-lg text-white text-[12px] font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex-shrink-0"
      >
        {{ isSaving ? "Saving..." : "Save" }}
      </button>
    </div>

    <!-- Action row: only when a key is stored -->
    <div
      v-if="
        authStore.apiKeyStatus !== 'not_set' &&
        authStore.apiKeyStatus !== 'unknown'
      "
      class="flex items-center gap-2 mt-2"
    >
      <template v-if="confirmingRemove">
        <span class="text-[12px] text-[var(--text-dim)]"
          >Remove stored key?</span
        >
        <button
          @click="confirmRemove"
          class="px-2.5 py-1 bg-[var(--danger)]/10 border border-[var(--danger)]/20 rounded-md text-[var(--danger)] text-[11px] font-bold hover:bg-[var(--danger)] hover:text-white transition-all"
        >
          Yes, remove
        </button>
        <button
          @click="confirmingRemove = false"
          class="px-2.5 py-1 bg-[var(--bg-hover)] border border-[var(--border-strong)] rounded-md text-[var(--text)] text-[11px] cursor-pointer hover:bg-[var(--bg-active)] transition-colors"
        >
          Cancel
        </button>
      </template>
      <template v-else>
        <button
          @click="handleValidate"
          :disabled="isBusy"
          class="px-2.5 py-1 bg-[var(--bg-hover)] border border-[var(--border-strong)] rounded-md text-[var(--text)] text-[11px] cursor-pointer hover:bg-[var(--bg-active)] transition-colors disabled:opacity-40"
        >
          {{
            authStore.apiKeyStatus === "checking" ? "Checking..." : "Validate"
          }}
        </button>
        <button
          @click="confirmingRemove = true"
          :disabled="isBusy"
          class="px-2.5 py-1 bg-[var(--bg-hover)] border border-[var(--border-strong)] rounded-md text-[var(--text)] text-[11px] cursor-pointer hover:bg-[var(--bg-active)] transition-colors disabled:opacity-40"
        >
          Remove
        </button>
      </template>
    </div>

    <!-- Error message: always visible when set, regardless of key status -->
    <p v-if="errorMsg" class="text-[11px] text-[var(--danger)] mt-2">
      {{ errorMsg }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useAuthStore } from "../../stores/auth";
import { useHostStore } from "../../stores/hosts";

const authStore = useAuthStore();
const hostStore = useHostStore();

const keyInput = ref("");
const showKey = ref(false);
const isSaving = ref(false);
const confirmingRemove = ref(false);
const errorMsg = ref("");

const isBusy = computed(
  () => isSaving.value || authStore.apiKeyStatus === "checking",
);

const statusLabel = computed(() => {
  switch (authStore.apiKeyStatus) {
    case "not_set":
    case "unknown":
      return "Not set";
    case "set":
      return "Key saved";
    case "valid":
      return "Valid";
    case "invalid":
      return "Invalid";
    case "checking":
      return "Checking...";
    default:
      return "Not set";
  }
});

const statusBadgeClass = computed(() => {
  switch (authStore.apiKeyStatus) {
    case "valid":
      return "bg-green-500/10 text-green-500";
    case "set":
      return "bg-[var(--accent)]/10 text-[var(--accent)]";
    case "invalid":
      return "bg-[var(--danger)]/10 text-[var(--danger)]";
    case "checking":
      return "bg-[var(--accent)]/10 text-[var(--accent)]";
    default:
      return "bg-[var(--bg-active)] text-[var(--text-dim)]";
  }
});

onMounted(() => {
  authStore.loadApiKeyStatus();
});

async function handleSave() {
  const trimmed = keyInput.value.trim();
  if (!trimmed || isBusy.value) return;
  isSaving.value = true;
  errorMsg.value = "";
  try {
    await authStore.saveApiKey(trimmed);
    keyInput.value = "";
    showKey.value = false;
    await handleValidate();
  } catch (err: unknown) {
    let msg = "Failed to save key.";
    if (typeof err === "object" && err !== null) {
      const vals = Object.values(err);
      if (vals.length > 0) msg = String(vals[0]);
    } else if (typeof err === "string") {
      msg = err;
    }
    errorMsg.value = msg;
  } finally {
    isSaving.value = false;
  }
}

async function handleValidate() {
  errorMsg.value = "";
  const hostId = hostStore.activeHostId;
  if (!hostId) {
    errorMsg.value = "No active host selected. Cannot validate.";
    return;
  }
  try {
    await authStore.validateApiKey(hostId);
  } catch {
    errorMsg.value = "Could not reach host to validate.";
  }
}

async function confirmRemove() {
  confirmingRemove.value = false;
  errorMsg.value = "";
  try {
    await authStore.removeApiKey();
    keyInput.value = "";
  } catch {
    errorMsg.value = "Failed to remove key.";
  }
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

.custom-input {
  background: var(--bg-input);
  border: 1px solid var(--border);
  color: var(--text);
  border-radius: 8px;
  padding: 6px 10px;
  font-size: 12px;
  outline: none;
  transition: all 0.2s;
}
.custom-input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px var(--accent-muted);
}
.custom-input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>

<template>
  <div
    class="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-[14px_18px]"
  >
    <div class="flex items-center justify-between mb-3">
      <div class="flex items-center gap-2">
        <svg
          class="w-3.5 h-3.5 text-[var(--accent)]"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
        <p class="text-[13px] font-semibold text-[var(--text)]">My Models</p>
      </div>
      <button
        @click="showAddDialog = true"
        class="flex items-center gap-1 text-[11px] font-semibold text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors"
      >
        <svg
          class="w-3 h-3"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="2.5"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M12 4v16m8-8H4"
          />
        </svg>
        Add model
      </button>
    </div>

    <div v-if="modelStore.privateModels.length === 0" class="py-3">
      <p class="text-[12px] text-[var(--text-dim)]">
        No private models yet. Push a local model to Ollama Cloud, or add a
        cloud model name manually.
      </p>
    </div>

    <ul v-else class="flex flex-col gap-1.5">
      <li
        v-for="name in modelStore.privateModels"
        :key="name"
        class="flex items-center justify-between gap-2 rounded-lg px-3 py-2 hover:bg-[var(--bg-hover)] transition-colors group"
      >
        <div class="flex items-center gap-2 min-w-0">
          <svg
            class="w-3.5 h-3.5 text-[var(--text-dim)] flex-shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
            <polyline points="8 21 12 17 16 21" />
          </svg>
          <span class="text-[13px] text-[var(--text)] font-mono truncate">{{
            name
          }}</span>
          <span
            v-if="pullState(name)"
            class="text-[11px] text-[var(--text-muted)] flex-shrink-0"
          >
            {{
              pullState(name)?.percent
                ? `${Math.round(pullState(name)!.percent)}%`
                : pullState(name)?.status
            }}
          </span>
        </div>
        <div class="flex items-center gap-1 flex-shrink-0">
          <button
            @click="pull(name)"
            :disabled="!!pullState(name)"
            class="text-[11px] font-semibold text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {{ modelStore.isInstalled(name) ? "Re-pull" : "Pull" }}
          </button>
          <button
            @click="remove(name)"
            class="text-[var(--text-dim)] hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 ml-1"
            title="Remove from list"
          >
            <svg
              class="w-3 h-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2.5"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      </li>
    </ul>

    <Teleport to="body">
      <div
        v-if="showAddDialog"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
        @click.self="closeAddDialog"
      >
        <div
          class="bg-[var(--bg-surface)] border border-[var(--border-strong)] rounded-2xl p-6 w-[360px] shadow-2xl animate-in fade-in zoom-in duration-150"
        >
          <p class="text-[15px] font-bold text-[var(--text)] mb-1">
            Add Private Model
          </p>
          <p class="text-[12px] text-[var(--text-muted)] mb-4 leading-relaxed">
            Enter the full cloud model name to add it to your list (e.g.
            <code class="font-mono text-[var(--accent)]"
              >username/model:tag</code
            >).
          </p>
          <input
            v-model="addName"
            @keydown.enter="confirmAdd"
            @keydown.escape="closeAddDialog"
            placeholder="username/model:latest"
            class="w-full bg-[var(--bg-input)] border border-[var(--border)] focus:border-[var(--accent)]/60 rounded-xl px-4 py-2.5 text-[13px] text-[var(--text)] outline-none placeholder-[var(--text-dim)] mb-2"
            autofocus
          />
          <p v-if="addError" class="text-[11px] text-red-400 mb-2">
            {{ addError }}
          </p>
          <div class="flex gap-2 justify-end">
            <button
              @click="closeAddDialog"
              class="px-4 py-1.5 text-[12px] text-[var(--text-muted)] rounded-lg hover:bg-[var(--bg-hover)] transition-colors"
            >
              Cancel
            </button>
            <button
              @click="confirmAdd"
              class="px-4 py-1.5 text-[12px] font-semibold bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-lg transition-colors"
            >
              Add
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { useModelStore } from "../../stores/models";

const modelStore = useModelStore();

const showAddDialog = ref(false);
const addName = ref("");
const addError = ref("");

function pullState(cloudName: string) {
  return modelStore.pulling[cloudName] ?? null;
}

async function pull(cloudName: string) {
  await modelStore.pullModel(cloudName);
}

async function remove(cloudName: string) {
  await modelStore.removePrivateModel(cloudName);
}

function closeAddDialog() {
  showAddDialog.value = false;
  addName.value = "";
  addError.value = "";
}

async function confirmAdd() {
  const name = addName.value.trim();
  if (!name) {
    addError.value = "Enter a model name";
    return;
  }
  if (!name.includes("/")) {
    addError.value = "Must include namespace (e.g. username/model:tag)";
    return;
  }
  await modelStore.addPrivateModel(name);
  closeAddDialog();
}
</script>

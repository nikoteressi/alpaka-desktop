<template>
  <div
    data-testid="error-screen"
    class="fixed inset-0 bg-[#F9FAFB] dark:bg-[#0F0F0F] flex items-center justify-center p-4 z-50"
  >
    <div
      class="max-w-md w-full bg-white dark:bg-[#1A1A1A] shadow-lg rounded-[16px] overflow-hidden border border-neutral-200 dark:border-neutral-800"
    >
      <div class="p-8 text-center flex flex-col items-center">
        <!-- Icon -->
        <div
          class="w-16 h-16 bg-red-50 text-red-500 dark:bg-red-900/20 dark:text-red-400 rounded-full flex items-center justify-center mb-6 text-3xl"
        >
          🦙
        </div>

        <h2
          class="text-xl font-semibold text-neutral-900 dark:text-neutral-100 mb-2"
        >
          Couldn't connect to Ollama
        </h2>
        <p
          class="text-[15px] text-neutral-600 dark:text-neutral-400 mb-8 max-w-[280px]"
        >
          The Ollama server at
          <span
            class="font-mono bg-neutral-100 dark:bg-neutral-800 px-1 rounded text-neutral-800 dark:text-neutral-300"
            >localhost:11434</span
          >
          is not responding.
        </p>

        <!-- Install Command Box -->
        <div
          class="w-full bg-neutral-50 dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 p-4 text-left mb-8 relative group"
        >
          <p
            class="text-xs font-semibold text-neutral-500 dark:text-neutral-400 mb-2 uppercase tracking-wide"
          >
            Install Ollama:
          </p>
          <code
            class="text-sm font-mono text-neutral-800 dark:text-neutral-300 break-all select-all"
          >
            curl -fsSL https://ollama.com/install.sh | sh
          </code>
          <CustomTooltip
            text="Copy to clipboard"
            wrapper-class="absolute top-3 right-3"
          >
            <button
              data-testid="copy-install-cmd"
              @click="copyInstallCmd"
              class="p-1.5 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 bg-white/80 dark:bg-neutral-800/80 backdrop-blur rounded shadow-sm opacity-0 group-hover:opacity-100 transition focus:opacity-100"
            >
              <svg
                v-if="copied"
                class="w-4 h-4 text-green-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M5 13l4 4L19 7"
                />
              </svg>
              <svg
                v-else
                class="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"
                />
              </svg>
            </button>
          </CustomTooltip>
        </div>

        <!-- Action Buttons -->
        <div class="w-full flex flex-col space-y-3">
          <button
            @click="emit('retry')"
            class="w-full py-2.5 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-900 dark:text-neutral-100 font-medium rounded-lg transition shadow-sm text-sm flex items-center justify-center cursor-pointer"
          >
            <svg
              class="w-4 h-4 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            Retry Connection
          </button>

          <button
            @click="startService"
            :disabled="isStartingService"
            class="w-full py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-lg transition shadow-sm text-sm flex items-center justify-center disabled:opacity-50 cursor-pointer"
          >
            <svg
              v-if="isStartingService"
              class="animate-spin w-4 h-4 mr-2"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                class="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                stroke-width="4"
              ></circle>
              <path
                class="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            <svg
              v-else
              class="w-4 h-4 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
              />
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            {{ isStartingService ? "Starting..." : "Start Ollama Service" }}
          </button>

          <button
            @click="emit('openSettings')"
            class="w-full py-2.5 border border-neutral-200 hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-300 font-medium rounded-lg transition text-sm flex items-center justify-center cursor-pointer"
          >
            <svg
              class="w-4 h-4 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            Change Host / Settings
          </button>
        </div>
      </div>

      <!-- Footer Note -->
      <div
        class="bg-neutral-50 dark:bg-neutral-900/50 p-6 border-t border-neutral-100 dark:border-neutral-800 text-[13px] text-neutral-500 dark:text-neutral-400"
      >
        <p class="mb-2">
          Already installed? The service may not be running. Click "Start Ollama
          Service" to run:
        </p>
        <code class="font-mono text-neutral-700 dark:text-neutral-300"
          >systemctl start ollama</code
        >
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { tauriApi } from "../../lib/tauri";
import CustomTooltip from "./CustomTooltip.vue";
import { useCopyToClipboard } from "../../composables/useCopyToClipboard";

const emit = defineEmits(["retry", "openSettings"]);

const { copied, copy } = useCopyToClipboard(2000);
const isStartingService = ref(false);
const installCmd = "curl -fsSL https://ollama.com/install.sh | sh";

async function copyInstallCmd() {
  await copy(installCmd);
}

async function startService() {
  isStartingService.value = true;
  try {
    // This expects the Rust command `start_ollama` to exist and run `systemctl`
    await tauriApi.startOllama();

    // Auto retry after a small delay
    setTimeout(() => {
      emit("retry");
      isStartingService.value = false;
    }, 1500);
  } catch (err) {
    console.error("Failed to start service:", err);
    isStartingService.value = false;
  }
}
</script>

<template>
  <div class="h-full overflow-y-auto bg-[var(--bg-base)] px-6 py-5">
    <div class="max-w-[660px] mx-auto flex flex-col gap-3.5">
      <div
        v-for="tool in LAUNCH_TOOLS"
        :key="tool.name"
        class="flex items-start gap-3.5"
      >
        <!-- Icon container -->
        <div
          class="w-11 h-11 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)] flex items-center justify-center flex-shrink-0"
        >
          <span class="text-[var(--text-muted)] font-bold text-[15px]">{{
            tool.name[0]
          }}</span>
        </div>

        <!-- Content -->
        <div class="flex-1 min-w-0">
          <p class="text-[14px] font-semibold text-[var(--text)] mb-0.5">
            {{ tool.name }}
          </p>
          <p class="text-[12.5px] text-[var(--text-muted)] mb-2 leading-snug">
            {{ tool.desc }}
          </p>
          <div
            class="flex items-center bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg px-3 py-1.5 gap-2"
          >
            <span
              class="flex-1 text-[12.5px] text-[var(--text-muted)] font-mono truncate"
              >{{ tool.cmd }}</span
            >
            <button
              @click="copyCmd(tool.cmd)"
              class="text-[var(--text-dim)] hover:text-[var(--text)] transition-colors flex-shrink-0 cursor-pointer"
              :title="copiedCmd === tool.cmd ? 'Copied!' : 'Copy command'"
            >
              <!-- Checkmark when copied -->
              <svg
                v-if="copiedCmd === tool.cmd"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <!-- Clipboard icon otherwise -->
              <svg
                v-else
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path
                  d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";

interface LaunchTool {
  name: string;
  desc: string;
  cmd: string;
}

const LAUNCH_TOOLS: LaunchTool[] = [
  {
    name: "Claude",
    desc: "Anthropic's coding tool with subagents",
    cmd: "ollama launch claude",
  },
  {
    name: "Codex",
    desc: "OpenAI's open-source coding agent",
    cmd: "ollama launch codex",
  },
  {
    name: "OpenCode",
    desc: "Anomaly's open-source coding agent",
    cmd: "ollama launch opencode",
  },
  {
    name: "Droid",
    desc: "Factory's coding agent across terminal and IDEs",
    cmd: "ollama launch droid",
  },
  {
    name: "Pi",
    desc: "Minimal AI agent toolkit with plugin support",
    cmd: "ollama launch pi",
  },
];

const copiedCmd = ref<string | null>(null);

async function copyCmd(cmd: string) {
  try {
    await navigator.clipboard.writeText(cmd);
    copiedCmd.value = cmd;
    setTimeout(() => {
      copiedCmd.value = null;
    }, 2000);
  } catch (err) {
    console.error("Failed to copy:", err);
  }
}
</script>

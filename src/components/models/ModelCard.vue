<template>
  <div
    class="model-card group"
    :class="{
      'model-card--clickable': !!onClick,
      'model-card--hovered': hovered,
    }"
    @mouseenter="hovered = true"
    @mouseleave="hovered = false"
    @click="onClick?.()"
  >
    <!-- Glow blob on hover -->
    <div
      class="model-card__glow"
      :style="{
        background: glowColor || 'rgba(74,128,208,0.13)',
        opacity: hovered ? '1' : '0',
      }"
    />

    <div class="model-card__inner">
      <!-- Header: icon + name/tags -->
      <div class="model-card__header flex items-start gap-3.5 mb-2.5">
        <!-- Letter icon -->
        <div
          class="model-card__icon w-[38px] h-[38px] rounded-[10px] bg-[var(--bg-hover)] border border-[var(--border-strong)] flex items-center justify-center flex-shrink-0 font-bold text-[16px] text-[var(--text)] transition-colors duration-200"
          :class="{ 'border-accent/40': hovered }"
        >
          {{ (name || "?").charAt(0).toUpperCase() }}
        </div>

        <div class="model-card__meta flex-1 min-w-0">
          <!-- Name row -->
          <div
            class="model-card__name-row flex items-center justify-between mb-1.5"
          >
            <div
              class="model-card__name-group flex items-center gap-1.5 min-w-0 flex-wrap"
            >
              <span
                class="model-card__name text-[15px] font-bold text-[var(--text)] transition-colors duration-200 truncate"
                :class="{ 'text-[var(--accent)]': hovered && !!onClick }"
              >
                {{ name }}
              </span>
              <span
                v-for="t in sizeTags"
                :key="t"
                :class="tagClass(t)"
                class="model-tag"
                >{{ t }}</span
              >
              <span
                v-if="quant"
                class="model-card__quant text-[10px] font-mono bg-[var(--tag-quant-bg)] color-[var(--tag-quant-text)] px-1.5 py-0.5 rounded border border-[var(--border)]"
                >{{ quant }}</span
              >
              <span
                v-if="isInstalled"
                class="model-card__pulled-badge text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-green-500/10 text-green-500 border border-green-500/20"
                >Pulled</span
              >
            </div>

            <div
              v-if="pullCount"
              class="model-card__pull-count flex items-center gap-1 text-[10px] text-[var(--text-dim)] bg-[var(--bg-base)] px-2 py-0.5 rounded-full border border-[var(--border)] flex-shrink-0 ml-2"
            >
              <svg
                width="9"
                height="9"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
                stroke-linecap="round"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              {{ pullCount }}
            </div>
          </div>

          <!-- Capability tags -->
          <div
            v-if="capTags.length"
            class="model-card__cap-tags flex flex-wrap gap-1"
          >
            <span
              v-for="t in capTags"
              :key="t"
              :class="tagClass(t)"
              class="model-tag"
              >{{ tagLabel(t) }}</span
            >
          </div>
        </div>
      </div>

      <!-- Description -->
      <p
        v-if="description"
        class="model-card__desc text-[12.5px] text-[var(--text-muted)] leading-[1.55] mb-3 line-clamp-2 h-9 overflow-hidden"
      >
        {{ description }}
      </p>

      <!-- Footer -->
      <div
        class="model-card__footer flex items-center justify-between border-t border-[var(--border-subtle)] pt-2.5"
      >
        <div class="model-card__footer-left flex items-center gap-2">
          <div
            v-if="date"
            class="model-card__date flex items-center gap-1.5 text-[10.5px] text-[var(--text-dim)]"
          >
            <div
              class="w-1.5 h-1.5 rounded-full bg-[var(--accent)] shadow-[0_0_5px_var(--accent)]"
            />
            {{ date }}
          </div>
          <span
            v-if="fileSize"
            class="model-card__filesize text-[10.5px] text-[var(--text-dim)]"
            :class="{ 'opacity-50': !!date }"
          >
            {{ date ? "· " : "" }}{{ fileSize }}
          </span>
        </div>

        <div class="model-card__footer-right flex items-center gap-1.5">
          <button
            v-if="onDelete"
            class="model-card__delete bg-none border-none text-[var(--text-dim)] p-1 flex transition-opacity duration-200"
            :class="hovered ? 'opacity-70' : 'opacity-30'"
            @click.stop="onDelete?.()"
            title="Delete model"
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            >
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              <path d="M10 11v6M14 11v6" />
              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
            </svg>
          </button>

          <button
            v-if="onAction && actionLabel"
            class="model-card__action flex items-center gap-1 font-bold text-[11px] bg-none border-none transition-all duration-200"
            :class="
              !onClick || hovered
                ? 'opacity-100 translate-x-0'
                : 'opacity-0 translate-x-[5px]'
            "
            :style="{ color: actionColor || 'var(--accent)' }"
            @click.stop="onAction?.()"
          >
            {{ actionLabel }}
            <svg
              width="11"
              height="11"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
            >
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </button>
        </div>
      </div>
    </div>

    <!-- Pull progress bar -->
    <div
      v-if="pullingPct !== undefined"
      class="model-card__progress-track absolute bottom-0 left-0 right-0 h-[3px] bg-[var(--bg-hover)]"
    >
      <div
        class="model-card__progress-fill h-full bg-[var(--accent)] shadow-[0_0_6px_var(--accent)] transition-[width] duration-300 ease-out"
        :style="{ width: pullingPct + '%' }"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";

const props = defineProps<{
  name: string;
  tags?: string[];
  description?: string;
  pullCount?: string;
  date?: string;
  fileSize?: string;
  quant?: string;
  isInstalled?: boolean;
  onClick?: () => void;
  onAction?: () => void;
  actionLabel?: string;
  actionColor?: string;
  onDelete?: () => void;
  pullingPct?: number;
  glowColor?: string;
}>();

const hovered = ref(false);

const sizeTags = computed(() =>
  (props.tags ?? []).filter((t) => /^\d+(\.\d+)?[bBmM]$/i.test(t)),
);
const capTags = computed(() =>
  (props.tags ?? []).filter((t) => !/^\d+(\.\d+)?[bBmM]$/i.test(t)),
);

const TAG_LABELS: Record<string, string> = {
  vision: "vision",
  tools: "tools",
  thinking: "think",
  think: "think",
  cloud: "cloud",
  embedding: "embed",
  embed: "embed",
  audio: "audio",
};

function tagLabel(t: string): string {
  return TAG_LABELS[t.toLowerCase()] ?? t;
}

function tagClass(t: string): string {
  const lc = t.toLowerCase();
  if (lc === "vision") return "tag-vision";
  if (lc === "tools") return "tag-tools";
  if (lc === "thinking" || lc === "think") return "tag-thinking";
  if (lc === "cloud") return "tag-cloud";
  if (lc === "embedding" || lc === "embed") return "tag-embedding";
  if (lc === "audio") return "tag-audio";
  if (/^\d+(\.\d+)?[bBmM]$/i.test(t)) return "tag-size";
  return "tag-generic";
}
</script>

<style scoped>
.model-card {
  position: relative;
  background: var(--bg-surface);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 18px;
  overflow: hidden;
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease;
}

.model-card--clickable {
  cursor: pointer;
}

.model-card--hovered {
  border-color: rgba(74, 128, 208, 0.4);
  box-shadow: 0 4px 24px rgba(74, 128, 208, 0.07);
}

.model-card__glow {
  position: absolute;
  top: -20px;
  right: -20px;
  width: 80px;
  height: 80px;
  border-radius: 50%;
  filter: blur(32px);
  pointer-events: none;
  transition: opacity 0.3s ease;
}

.model-card__inner {
  position: relative;
}
</style>

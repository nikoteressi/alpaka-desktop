<template>
  <div class="relative" ref="attachMenuRef">
    <input
      type="file"
      ref="imageInput"
      class="hidden"
      accept="image/*"
      multiple
      @change="onImageInputChange"
    />

    <CustomTooltip text="Attach" wrapper-class="block">
      <button
        @click="toggleMenu"
        :disabled="disabled"
        class="w-7 h-7 rounded-full bg-[var(--bg-elevated)] border border-[var(--border-strong)] flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--bg-active)] hover:text-[var(--text)] transition-colors cursor-pointer disabled:opacity-40"
        :class="{
          'text-[var(--text)] bg-[var(--bg-active)]': isOpen,
        }"
        aria-label="Attach"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>
    </CustomTooltip>

    <!-- Attachment Menu -->
    <transition name="pop-up">
      <div
        v-if="isOpen"
        class="absolute bottom-full left-0 mb-3 z-50 w-44 bg-[var(--bg-surface)] border border-[var(--border-strong)] rounded-xl shadow-2xl py-1 overflow-hidden"
      >
        <button
          @click="triggerImageUpload"
          class="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-[var(--text)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer border-none bg-transparent"
        >
          <svg
            class="w-3.5 h-3.5 opacity-70"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
          Attach Images
        </button>
        <button
          @click="onPickFile"
          :disabled="isLinking"
          class="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-[var(--text)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer border-none bg-transparent disabled:opacity-50"
        >
          <svg
            class="w-3.5 h-3.5 opacity-70"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path
              d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
            />
            <polyline points="14 2 14 8 20 8" />
          </svg>
          Link File Context
        </button>
        <button
          @click="onPickFolder"
          :disabled="isLinking"
          class="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-[var(--text)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer border-none bg-transparent disabled:opacity-50"
        >
          <svg
            class="w-3.5 h-3.5 opacity-70"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path
              d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"
            />
          </svg>
          Link Folder Context
        </button>
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import CustomTooltip from "../../shared/CustomTooltip.vue";

const props = defineProps<{
  disabled?: boolean;
  isLinking?: boolean;
}>();

const emit = defineEmits<{
  (e: "files", files: FileList): void;
  (e: "pick-file"): void;
  (e: "pick-folder"): void;
}>();

const isOpen = ref(false);
const attachMenuRef = ref<HTMLElement | null>(null);
const imageInput = ref<HTMLInputElement | null>(null);

function toggleMenu() {
  isOpen.value = !isOpen.value;
}

function close() {
  isOpen.value = false;
}

function triggerImageUpload() {
  isOpen.value = false;
  imageInput.value?.click();
}

function onImageInputChange(e: Event) {
  const files = (e.target as HTMLInputElement).files;
  if (files && files.length > 0) emit("files", files);
  if (imageInput.value) imageInput.value.value = "";
}

function onPickFile() {
  isOpen.value = false;
  emit("pick-file");
}

function onPickFolder() {
  isOpen.value = false;
  emit("pick-folder");
}

function onOutsideClick(e: MouseEvent) {
  if (isOpen.value && attachMenuRef.value) {
    if (!attachMenuRef.value.contains(e.target as Node)) {
      isOpen.value = false;
    }
  }
}

onMounted(() => {
  document.addEventListener("mousedown", onOutsideClick);
});

onUnmounted(() => {
  document.removeEventListener("mousedown", onOutsideClick);
});

defineExpose({ close });
</script>

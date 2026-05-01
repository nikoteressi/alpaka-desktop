<template>
  <div
    class="flex flex-col h-full animate-in fade-in slide-in-from-left-2 duration-300"
  >
    <!-- Breadcrumb -->
    <div class="flex items-center gap-2.5 mb-5">
      <button
        @click="handleBack"
        class="flex items-center gap-1.5 text-[13px] text-[var(--text-muted)] hover:text-[var(--text)] transition-all py-1 px-2 rounded-md hover:bg-[var(--bg-hover)]"
      >
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"
        >
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
        <span>Models</span>
      </button>
      <span class="text-[var(--text-dim)] text-[12px] opacity-60">/</span>
      <span class="text-[13px] text-[var(--text)] font-semibold">{{
        isEditing ? `Edit: ${modelName}` : "Create model"
      }}</span>
    </div>

    <!-- Phase 1: Edit -->
    <div v-if="phase === 'edit'" class="flex flex-col gap-4 flex-1 min-h-0">
      <div class="flex flex-col gap-1.5">
        <label
          for="model-name-input"
          class="text-[11px] font-bold text-[var(--text-dim)] uppercase tracking-wider"
          >Model name</label
        >
        <input
          id="model-name-input"
          v-model="modelName"
          type="text"
          placeholder="e.g. my-assistant"
          class="bg-[var(--bg-input)] border rounded-xl px-3 py-2 text-[13px] text-[var(--text)] placeholder-[var(--text-dim)] outline-none transition-colors"
          :class="
            nameError
              ? 'border-[var(--danger)]'
              : 'border-[var(--border)] focus:border-[var(--accent)]'
          "
        />
        <p v-if="nameError" class="text-[11px] text-[var(--danger)]">
          {{ nameError }}
        </p>
        <p
          v-else-if="isEditing && modelName !== props.initialName"
          class="text-[11px] text-[var(--accent)]"
        >
          Different name → creates a new model (original unchanged)
        </p>
      </div>

      <div class="flex flex-col gap-1.5 flex-1 min-h-0">
        <p
          class="text-[11px] font-bold text-[var(--text-dim)] uppercase tracking-wider"
        >
          Modelfile
        </p>
        <div
          ref="editorContainer"
          class="flex-1 min-h-[300px] rounded-xl border border-[var(--border)] overflow-hidden text-[13px] font-mono"
        />
      </div>

      <div class="flex items-center gap-2 justify-end pt-1">
        <button
          @click="handleBack"
          class="px-4 py-1.5 text-[12px] text-[var(--text-muted)] hover:text-[var(--text)] border border-[var(--border)] rounded-lg hover:bg-[var(--bg-hover)] transition-colors"
        >
          Cancel
        </button>
        <button
          :disabled="!modelName.trim() || !!nameError"
          @click="handleCreate"
          class="px-4 py-1.5 text-[12px] font-semibold text-white bg-[var(--accent)] rounded-lg hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {{ isEditing ? "Update" : "Create" }}
        </button>
      </div>
    </div>

    <!-- Phase 2: Progress -->
    <div
      v-else-if="phase === 'progress'"
      class="flex flex-col gap-4 flex-1 min-h-0"
    >
      <!-- Status banner -->
      <div
        class="flex items-center gap-3 px-4 py-3 rounded-xl border flex-shrink-0"
        :class="{
          'bg-[var(--bg-surface)] border-[var(--border)]':
            displayPhase === 'running',
          'bg-green-500/10 border-green-500/30': displayPhase === 'done',
          'bg-red-500/10 border-red-500/30': displayPhase === 'error',
          'bg-yellow-500/10 border-yellow-500/30': displayPhase === 'cancelled',
        }"
      >
        <div
          v-if="displayPhase === 'running'"
          class="w-3 h-3 rounded-full bg-[var(--accent)] animate-pulse flex-shrink-0"
        />
        <svg
          v-else-if="displayPhase === 'done'"
          class="w-4 h-4 text-green-400 flex-shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="2.5"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M5 13l4 4L19 7"
          />
        </svg>
        <svg
          v-else
          class="w-4 h-4 text-red-400 flex-shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="2"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
        <span class="text-[13px] font-medium text-[var(--text)]">
          <template v-if="displayPhase === 'running'"
            >Creating {{ modelName }}…</template
          >
          <template v-else-if="displayPhase === 'done'"
            >{{ modelName }} created successfully</template
          >
          <template v-else-if="displayPhase === 'cancelled'"
            >Creation cancelled</template
          >
          <template v-else>Creation failed</template>
        </span>
      </div>

      <!-- Log output — fixed height so buttons are always visible below -->
      <div
        class="h-[220px] bg-[var(--bg-input)] border border-[var(--border)] rounded-xl p-3 overflow-hidden flex-shrink-0"
      >
        <pre
          ref="logEl"
          class="text-[12px] text-[var(--text-muted)] font-mono whitespace-pre-wrap break-words h-full overflow-y-auto"
          >{{ logText }}</pre
        >
      </div>

      <!-- Action buttons — always visible below the log -->
      <div class="flex items-center gap-2 justify-end">
        <button
          v-if="displayPhase === 'running'"
          :disabled="cancelSent"
          @click="handleCancel"
          class="px-4 py-1.5 text-[12px] text-[var(--danger)] border border-[var(--danger)]/40 rounded-lg hover:bg-[var(--danger)]/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {{ cancelSent ? "Cancelling…" : "Cancel" }}
        </button>
        <template v-else-if="displayPhase === 'done'">
          <button
            @click="handleDoneBack"
            class="px-4 py-1.5 text-[12px] text-[var(--text-muted)] border border-[var(--border)] rounded-lg hover:bg-[var(--bg-hover)] transition-colors"
          >
            Back to Models
          </button>
          <button
            @click="emit('view-model', modelName)"
            class="px-4 py-1.5 text-[12px] font-semibold text-white bg-[var(--accent)] rounded-lg hover:opacity-90 transition-opacity"
          >
            View model
          </button>
        </template>
        <template v-else>
          <button
            @click="backToEditor"
            class="px-4 py-1.5 text-[12px] text-[var(--text-muted)] border border-[var(--border)] rounded-lg hover:bg-[var(--bg-hover)] transition-colors"
          >
            Back to editor
          </button>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from "vue";
import { EditorView, basicSetup } from "codemirror";
import { EditorState } from "@codemirror/state";
import { StreamLanguage, StringStream } from "@codemirror/language";
import { oneDark } from "@codemirror/theme-one-dark";
import { useModelStore } from "../../stores/models";
import { useModelCreate } from "../../composables/useModelCreate";

const MODELFILE_TEMPLATE = `FROM llama3

SYSTEM """
You are a helpful assistant.
"""

PARAMETER temperature 0.7
PARAMETER top_p 0.9
`;

const MODELFILE_KEYWORDS = [
  "FROM",
  "SYSTEM",
  "PARAMETER",
  "TEMPLATE",
  "MESSAGE",
  "ADAPTER",
  "LICENSE",
];

function matchSolToken(stream: StringStream): string | null {
  for (const kw of MODELFILE_KEYWORDS) {
    if (stream.match(kw) && (stream.eol() || /\s/.test(stream.peek() ?? "")))
      return "keyword";
  }
  if (stream.match("#")) {
    stream.skipToEnd();
    return "comment";
  }
  return null;
}

function scanString(stream: StringStream, delim: string): "string" {
  while (!stream.match(delim)) {
    if (stream.eol()) break;
    stream.next();
  }
  return "string";
}

const modelfileLanguage = StreamLanguage.define({
  token(stream) {
    if (stream.sol()) {
      const t = matchSolToken(stream);
      if (t !== null) return t;
    }
    if (stream.match('"""')) return scanString(stream, '"""');
    if (stream.match('"')) return scanString(stream, '"');
    if (stream.match(/\d+(\.\d+)?/)) return "number";
    stream.next();
    return null;
  },
});

const props = defineProps<{
  initialName: string;
  initialModelfile: string;
}>();

const emit = defineEmits<{
  back: [];
  "view-model": [name: string];
}>();

const modelStore = useModelStore();
const { start, cancel } = useModelCreate();

const modelName = ref(props.initialName);
const phase = ref<"edit" | "progress">("edit");
const cancelSent = ref(false);
const editorContainer = ref<HTMLElement | null>(null);
const logEl = ref<HTMLElement | null>(null);
let editorView: EditorView | null = null;

const isEditing = computed(() => !!props.initialName);
const createState = computed(() => modelStore.creating[modelName.value]);

// When the store entry is deleted (e.g. on cancel), capture the last known
// terminal phase so the banner still renders until the user navigates away.
const snapshotPhase = ref<"done" | "error" | "cancelled" | null>(null);
watch(createState, (cur, prev) => {
  if (!cur && prev && prev.phase !== "running") {
    snapshotPhase.value = prev.phase;
  }
});
const displayPhase = computed(
  () => createState.value?.phase ?? snapshotPhase.value ?? "running",
);

// Ollama model names: lowercase letters, digits, hyphens, underscores, dots, colons for tags.
// No spaces or uppercase.
const nameError = computed(() => {
  const n = modelName.value.trim();
  if (!n) return "";
  if (/\s/.test(n)) return "Name cannot contain spaces";
  if (!/^[a-zA-Z0-9._:/-]+$/.test(n))
    return "Only letters, digits, hyphens, underscores, dots, colons, and slashes are allowed";
  return "";
});
const logText = computed(() => createState.value?.logLines.join("\n") ?? "");

onMounted(async () => {
  // If navigating back to an in-progress creation, jump to progress phase
  const existing = modelStore.creating[props.initialName];
  if (existing?.phase === "running") {
    phase.value = "progress";
    return;
  }
  await nextTick();
  initEditor();
});

onUnmounted(() => {
  editorView?.destroy();
});

function initEditor() {
  if (!editorContainer.value) return;
  editorView = new EditorView({
    state: EditorState.create({
      doc: props.initialModelfile || MODELFILE_TEMPLATE,
      extensions: [
        basicSetup,
        modelfileLanguage,
        oneDark,
        EditorView.theme({
          "&": { background: "transparent", height: "100%" },
          ".cm-scroller": {
            fontFamily: "var(--font-mono, monospace)",
            overflow: "auto",
          },
        }),
      ],
    }),
    parent: editorContainer.value,
  });
}

async function handleCreate() {
  const name = modelName.value.trim();
  if (!name) return;
  const content = editorView?.state.doc.toString() ?? "";
  editorView?.destroy();
  editorView = null;
  phase.value = "progress";
  try {
    await start(name, content);
  } catch {
    // Error is surfaced via store state (set by useModelCreate) or model:create-error event;
    // swallow here so Vue's global handler doesn't fire.
  }
}

async function handleCancel() {
  cancelSent.value = true;
  await cancel(modelName.value);
}

function backToEditor() {
  const saved = createState.value?.modelfile;
  modelStore.clearCreateState(modelName.value);
  phase.value = "edit";
  cancelSent.value = false;
  nextTick(() => {
    if (!editorView) {
      initEditor();
    }
    if (editorView && saved) {
      editorView.dispatch({
        changes: {
          from: 0,
          to: editorView.state.doc.length,
          insert: saved,
        },
      });
    }
  });
}

function handleDoneBack() {
  modelStore.clearCreateState(modelName.value);
  emit("back");
}

function handleBack() {
  // In progress phase: navigate away WITHOUT cancelling (creation continues in background)
  // In edit phase: just go back
  emit("back");
}

// Auto-scroll log to bottom as new lines arrive
watch(logText, () => {
  nextTick(() => {
    if (logEl.value) {
      logEl.value.scrollTop = logEl.value.scrollHeight;
    }
  });
});
</script>

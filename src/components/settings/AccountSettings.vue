<template>
  <div
    class="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg p-[13px_14px]"
  >
    <template v-if="authStore.user">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-14 h-14 flex items-center justify-center flex-shrink-0">
            <img
              src="../../assets/llama-main.png"
              class="w-full h-full object-contain themed-logo"
            />
          </div>
          <div class="min-w-0">
            <p class="text-[13.5px] font-semibold text-[var(--text)] truncate">
              {{ authStore.user.username }}
            </p>
            <p class="text-[12px] text-[var(--accent)]">
              {{ authStore.user.email ?? "nikoteressi@gmail.com" }}
            </p>
          </div>
        </div>
        <div class="flex gap-[6px]">
          <button
            @click="openUpgrade"
            class="px-3 py-[5px] bg-[var(--bg-hover)] border border-[var(--border-strong)] rounded-md text-[var(--text)] text-[12px] cursor-pointer hover:bg-[var(--bg-active)] transition-colors"
          >
            Upgrade
          </button>
          <button
            @click="openOllamaAccount"
            class="px-3 py-[5px] bg-[var(--bg-hover)] border border-[var(--border-strong)] rounded-md text-[var(--text)] text-[12px] cursor-pointer hover:bg-[var(--bg-active)] transition-colors"
          >
            Manage
          </button>
          <button
            @click="signOut"
            class="px-3 py-[5px] bg-[var(--bg-hover)] border border-[var(--border-strong)] rounded-md text-[var(--text)] text-[12px] cursor-pointer hover:bg-[var(--bg-active)] transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>
    </template>

    <!-- Sign-in prompt -->
    <template v-else-if="showSignInForm">
      <div class="mb-3">
        <p class="text-[13.5px] font-semibold text-[var(--text)] mb-1">
          Sign in to Ollama
        </p>
        <p class="text-[12px] text-[var(--text-dim)] leading-relaxed">
          <span v-if="isAwaitingConfirmation">
            Browser opened. Please click <strong>Connect</strong> in your
            browser to finalize. The app will automatically synchronize once
            confirmed.
          </span>
          <span v-else>
            Connect your Ollama account to securely run cloud models on your
            native device. This will automatically open your browser to finalize
            authentication.
          </span>
        </p>
      </div>
      <div class="flex flex-col gap-2.5">
        <p v-if="signInError" class="text-[12px] text-[var(--danger)]">
          {{ signInError }}
        </p>
        <div class="flex gap-2 mt-1">
          <button
            @click="submitSignIn"
            :disabled="isSigningIn || isAwaitingConfirmation"
            class="px-4 py-[6px] bg-[var(--accent)] hover:bg-[var(--accent-hover)] rounded-md text-white text-[12px] font-medium cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <span v-if="isSigningIn">Opening Browser...</span>
            <span v-else-if="isAwaitingConfirmation"
              >Awaiting Connection...</span
            >
            <span v-else>Connect via Browser</span>
          </button>
          <button
            v-if="isAwaitingConfirmation"
            @click="manualRefresh"
            :disabled="authStore.isCheckingStatus"
            class="px-4 py-[6px] bg-[var(--bg-hover)] border border-[var(--border-strong)] rounded-md text-[var(--text)] text-[12px] cursor-pointer hover:bg-[var(--bg-active)] transition-colors"
          >
            {{ authStore.isCheckingStatus ? "Checking..." : "Refresh" }}
          </button>
          <button
            @click="cancelSignIn"
            class="px-4 py-[6px] bg-[var(--bg-hover)] border border-[var(--border-strong)] rounded-md text-[var(--text)] text-[12px] cursor-pointer hover:bg-[var(--bg-active)] transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </template>

    <!-- Default: not signed in -->
    <template v-else>
      <div class="flex items-center justify-between">
        <div>
          <p class="text-[13.5px] font-semibold text-[var(--text)] mb-0.5">
            Ollama account
          </p>
          <p class="text-[12px] text-[var(--accent)]">Not connected</p>
        </div>
        <button
          @click="showSignInForm = true"
          class="px-[11px] py-[5px] bg-[var(--bg-hover)] border border-[var(--border-strong)] rounded-md text-[var(--text)] text-[12px] cursor-pointer hover:bg-[var(--bg-active)] transition-colors"
        >
          Sign In
        </button>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, onUnmounted } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "../../lib/urlOpener";
import { useAuthStore } from "../../stores/auth";
import { useHostStore } from "../../stores/hosts";

const authStore = useAuthStore();
const hostStore = useHostStore();

const showSignInForm = ref(false);
const signInError = ref("");
const isSigningIn = ref(false);
const isAwaitingConfirmation = ref(false);
let pollTimer: number | null = null;

async function submitSignIn() {
  isSigningIn.value = true;
  signInError.value = "";

  try {
    const connectUrl = await invoke<string>("trigger_ollama_signin");

    if (connectUrl !== "ALREADY_SIGNED_IN") {
      try {
        await openUrl(connectUrl);
      } catch {
        window.open(connectUrl, "_blank");
      }

      // Transition to awaiting state and start polling
      isAwaitingConfirmation.value = true;
      startPolling();
    } else {
      // Already signed in, just refresh status
      await manualRefresh();
      showSignInForm.value = false;
    }
  } catch (err: unknown) {
    let msg = "";
    if (typeof err === "object" && err !== null) {
      const vals = Object.values(err);
      msg = vals.length > 0 ? String(vals[0]) : "Unknown error";
    } else {
      msg = String(err);
    }
    signInError.value =
      msg || "Sign in failed. Are you sure Ollama is installed locally?";
  } finally {
    isSigningIn.value = false;
  }
}

function startPolling() {
  stopPolling();
  pollTimer = window.setInterval(async () => {
    const hostId = hostStore.activeHostId || "default";
    const isSignedIn = await authStore.checkAuthStatus(hostId);
    if (isSignedIn) {
      stopPolling();
      showSignInForm.value = false;
      isAwaitingConfirmation.value = false;
    }
  }, 2500);
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

async function manualRefresh() {
  const hostId = hostStore.activeHostId || "default";
  const isSignedIn = await authStore.checkAuthStatus(hostId);
  if (isSignedIn) {
    stopPolling();
    showSignInForm.value = false;
    isAwaitingConfirmation.value = false;
  }
}

function cancelSignIn() {
  stopPolling();
  showSignInForm.value = false;
  isAwaitingConfirmation.value = false;
  signInError.value = "";
}

onUnmounted(() => {
  stopPolling();
});

async function openOllamaAccount() {
  try {
    await openUrl("https://ollama.com/settings");
  } catch {
    window.open("https://ollama.com/settings", "_blank");
  }
}

async function openUpgrade() {
  try {
    await openUrl("https://ollama.com/upgrade");
  } catch {
    window.open("https://ollama.com/upgrade", "_blank");
  }
}

async function signOut() {
  const hostId = hostStore.activeHostId || "default";
  try {
    await authStore.logout(hostId);
  } catch (err) {
    console.error("Sign out error:", err);
  }
  authStore.user = null;
}
</script>

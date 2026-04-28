import { computed, ref, onMounted, onUnmounted } from "vue";
import { useSettingsStore } from "../stores/settings";

export function useTheme() {
  const settingsStore = useSettingsStore();

  const theme = computed(() => settingsStore.theme ?? "system");

  // Reactive system dark preference
  const systemDark = ref(
    typeof window !== "undefined"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
      : true,
  );

  const isDark = computed(() => {
    if (theme.value === "dark") return true;
    if (theme.value === "light") return false;
    return systemDark.value;
  });

  let mq: MediaQueryList | null = null;
  const onSystemChange = (e: MediaQueryListEvent) => {
    systemDark.value = e.matches;
  };

  onMounted(() => {
    mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", onSystemChange);
  });

  onUnmounted(() => {
    mq?.removeEventListener("change", onSystemChange);
  });

  function setTheme(t: "dark" | "light" | "system") {
    settingsStore.setTheme(t);
  }

  return { theme, isDark, setTheme };
}

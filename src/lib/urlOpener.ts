import { tauriApi } from "./tauri";

export async function openUrl(url: string): Promise<void> {
  if (!url.startsWith("https://") && !url.startsWith("http://")) {
    return;
  }
  try {
    await tauriApi.openBrowser(url);
  } catch {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

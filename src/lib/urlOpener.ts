import { tauriApi } from "./tauri";

/**
 * Opens a URL in the system's default browser.
 * Uses the backend open_browser command which abstracts tauri-plugin-opener.
 */
export async function openUrl(url: string): Promise<void> {
  try {
    await tauriApi.openBrowser(url);
  } catch {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

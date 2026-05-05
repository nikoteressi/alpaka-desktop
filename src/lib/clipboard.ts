/**
 * Copies the provided text to the system clipboard.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && globalThis.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    // Fallback? Browsers generally require secure context for clipboard API.
    return false;
  } catch (err) {
    console.error("Failed to copy to clipboard:", err);
    return false;
  }
}

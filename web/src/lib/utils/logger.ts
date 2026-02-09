/**
 * Development-mode logger.
 * In production builds, Vite replaces import.meta.env.DEV with false,
 * so the dead-code elimination will tree-shake away the console calls.
 */

export const logger = {
  warn(context: string, error?: unknown) {
    if (import.meta.env.DEV) {
      // biome-ignore lint/suspicious/noConsole: intentional dev-mode logging
      console.warn(`[NightSeek] ${context}`, error ?? '');
    }
  },
  error(context: string, error?: unknown) {
    if (import.meta.env.DEV) {
      // biome-ignore lint/suspicious/noConsole: intentional dev-mode logging
      console.error(`[NightSeek] ${context}`, error ?? '');
    }
  },
};

/**
 * Development-mode logger.
 * In production builds, the dead-code elimination in Vite
 * will tree-shake away the console calls since NODE_ENV === 'production'.
 */

export const logger = {
  warn(context: string, error?: unknown) {
    if (process.env.NODE_ENV !== 'production') {
      // biome-ignore lint/suspicious/noConsole: intentional dev-mode logging
      console.warn(`[NightSeek] ${context}`, error ?? '');
    }
  },
  error(context: string, error?: unknown) {
    if (process.env.NODE_ENV !== 'production') {
      // biome-ignore lint/suspicious/noConsole: intentional dev-mode logging
      console.error(`[NightSeek] ${context}`, error ?? '');
    }
  },
};

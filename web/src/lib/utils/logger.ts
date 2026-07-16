/**
 * Development-mode logger.
 * In production builds, Vite replaces import.meta.env.DEV with false,
 * so the dead-code elimination will tree-shake away the console calls.
 */

function describeError(error: unknown): unknown {
  if (!(error instanceof Error)) return error ?? '';

  const cause = 'cause' in error ? error.cause : undefined;
  const ownDescription = error.stack ?? error.message;
  return cause === undefined
    ? ownDescription
    : `${ownDescription}\nCaused by: ${String(describeError(cause))}`;
}

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
      console.error(`[NightSeek] ${context}`, describeError(error));
    }
  },
};

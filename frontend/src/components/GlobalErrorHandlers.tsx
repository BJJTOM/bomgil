"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

/**
 * Catches the two error classes the React error boundary doesn't see:
 * window.onerror (uncaught sync exceptions outside React's tree, e.g.
 * inside a setTimeout) and unhandledrejection (uncaught Promise
 * rejections from fetch/await chains that no one .catch'd).
 *
 * Both forward to Sentry when the DSN is configured. Without it, the
 * handlers are still installed so we get a `console.error` line —
 * useful in dev and in case Sentry is rate-limited.
 */
export function GlobalErrorHandlers() {
  useEffect(() => {
    const hasDsn = !!process.env.NEXT_PUBLIC_SENTRY_DSN;

    const onError = (event: ErrorEvent) => {
      console.error("[GlobalError]", event.error || event.message);
      if (hasDsn && event.error) {
        try {
          Sentry.captureException(event.error, {
            tags: { source: "window.onerror" },
          });
        } catch {
          /* never let the error handler throw */
        }
      }
    };

    const onRejection = (event: PromiseRejectionEvent) => {
      console.error("[UnhandledRejection]", event.reason);
      if (hasDsn) {
        try {
          Sentry.captureException(event.reason, {
            tags: { source: "unhandledrejection" },
          });
        } catch {
          /* swallow */
        }
      }
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}

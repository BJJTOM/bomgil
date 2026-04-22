/**
 * Non-React bridge that lets modules outside the React tree (axios
 * interceptors, plain helpers) raise the toast UI. The ToastProvider
 * calls `registerToastHandler` on mount to wire itself in.
 *
 * Rendering a toast from inside an `axios.interceptors.response` is
 * otherwise impossible without pulling axios into React — this keeps
 * the decoupling.
 */
type ToastType = "success" | "error" | "info";

let handler: (message: string, type?: ToastType) => void = () => {};

export function registerToastHandler(fn: (message: string, type?: ToastType) => void) {
  handler = fn;
}

export function globalToast(message: string, type: ToastType = "info") {
  if (!message) return;
  handler(message, type);
}

/**
 * Pull a human-readable message out of any axios error shape. DRF
 * responses come in several flavours:
 *   - { detail: "..." }
 *   - { field: ["error"], field2: ["error"] }
 *   - { non_field_errors: ["..."] }
 *   - "<html>...Server Error (500)..." (when DEBUG=False and an
 *     uncaught exception fires)
 */
export function extractApiErrorMessage(
  err: unknown,
  fallback = "요청 처리 중 문제가 발생했습니다.",
): string {
  const anyErr = err as {
    response?: { data?: unknown; status?: number; headers?: Record<string, string> };
    message?: string;
  };
  const status = anyErr?.response?.status;
  const data = anyErr?.response?.data;

  // 429: rate-limited. Prefer Retry-After header (seconds) when present
  // and always use a friendly Korean sentence so the user knows this
  // isn't a bug in their input — it's "slow down."
  if (status === 429) {
    const headers = anyErr?.response?.headers || {};
    const retryAfter = headers["retry-after"] || headers["Retry-After"];
    const detailSeconds = (() => {
      if (data && typeof data === "object") {
        const d = (data as Record<string, unknown>).detail;
        if (typeof d === "string") {
          const m = d.match(/(\d+)\s*second/);
          if (m) return parseInt(m[1], 10);
        }
      }
      return null;
    })();
    const seconds = Number(retryAfter) || detailSeconds;
    if (seconds && seconds > 0) {
      return `요청이 너무 잦아요. ${seconds}초 후 다시 시도해주세요.`;
    }
    return "요청이 너무 잦아요. 잠시 후 다시 시도해주세요.";
  }

  if (typeof data === "string") {
    // HTML 500 page — don't dump raw HTML to the user
    if (data.includes("<html") || data.includes("<!DOCTYPE")) {
      if (status && status >= 500) return "서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.";
      return fallback;
    }
    return data;
  }

  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    if (typeof obj.detail === "string") return obj.detail;
    if (Array.isArray(obj.non_field_errors) && obj.non_field_errors.length)
      return String(obj.non_field_errors[0]);
    // Pick the first field error
    for (const v of Object.values(obj)) {
      if (Array.isArray(v) && v.length && typeof v[0] === "string") return v[0];
      if (typeof v === "string") return v;
    }
  }

  if (anyErr?.message) return anyErr.message;
  return fallback;
}

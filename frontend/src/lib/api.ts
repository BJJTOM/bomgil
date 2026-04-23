import axios from "axios";
import { useAuthStore } from "@/stores/auth";
import { extractApiErrorMessage, globalToast } from "@/lib/globalToast";

// In dev, route through Next.js rewrite (`/api/v1/*`) to bypass CORS.
// In prod, talk directly to the configured API host.
const baseURL = (
  process.env.NODE_ENV === "development"
    ? "/api/v1"
    : process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001/api/v1"
).trim();

const api = axios.create({
  baseURL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor: attach JWT token
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor:
//   1. On 401, try the refresh-token dance once per request.
//   2. On any other error the caller hasn't explicitly muted (via
//      `config._silent = true`), surface a toast so the user isn't
//      left staring at a silently-failing button.
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config || {};

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      const refreshToken = useAuthStore.getState().refreshToken;
      if (refreshToken) {
        try {
          const { data } = await axios.post(
            `${api.defaults.baseURL}/auth/token/refresh/`,
            { refresh: refreshToken }
          );
          useAuthStore.getState().setTokens(data.access, data.refresh);
          originalRequest.headers.Authorization = `Bearer ${data.access}`;
          return api(originalRequest);
        } catch {
          useAuthStore.getState().logout();
          globalToast("세션이 만료되었습니다. 다시 로그인해주세요.", "error");
          return Promise.reject(error);
        }
      }
    }

    // Surface a toast for any non-401 failure unless the caller opted out.
    const status = error.response?.status;
    if (!originalRequest._silent && status !== 401) {
      const msg = extractApiErrorMessage(error);
      globalToast(msg, "error");
    }

    return Promise.reject(error);
  }
);

export default api;

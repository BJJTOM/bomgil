import axios from "axios";
import { useAuthStore } from "@/stores/auth";

// In dev, route through Next.js rewrite (`/api/v1/*`) to bypass CORS.
// In prod, talk directly to the configured API host.
const baseURL =
  process.env.NODE_ENV === "development"
    ? "/api/v1"
    : process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001/api/v1";

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

// Response interceptor: auto-refresh on 401
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

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
        }
      }
    }

    return Promise.reject(error);
  }
);

export default api;

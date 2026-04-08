import axios from 'axios';
import { useAuthStore } from '../stores/auth';

const API_URL = 'https://api.moruwalk.com/api/v1';

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  // Don't set Content-Type for FormData — let RN set it with boundary
  if (config.data && (config.data instanceof FormData || config.data._parts)) {
    if (typeof config.headers?.delete === 'function') {
      config.headers.delete('Content-Type');
    } else {
      delete (config.headers as any)['Content-Type'];
    }
  }
  return config;
});

// Token refresh lock to prevent race conditions
let isRefreshing = false;
let refreshSubscribers: Array<{
  resolve: (token: string) => void;
  reject: (err: any) => void;
}> = [];

function onRefreshed(token: string) {
  const subs = refreshSubscribers;
  refreshSubscribers = [];
  subs.forEach((s) => s.resolve(token));
}

function onRefreshFailed(err: any) {
  const subs = refreshSubscribers;
  refreshSubscribers = [];
  subs.forEach((s) => s.reject(err));
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true;

      if (isRefreshing) {
        // Another request is already refreshing — queue this one
        return new Promise((resolve, reject) => {
          refreshSubscribers.push({
            resolve: (newToken: string) => {
              originalRequest.headers = originalRequest.headers || {};
              originalRequest.headers.Authorization = `Bearer ${newToken}`;
              resolve(api(originalRequest));
            },
            reject,
          });
        });
      }

      const refreshToken = useAuthStore.getState().refreshToken;
      if (!refreshToken) {
        return Promise.reject(error);
      }

      isRefreshing = true;
      try {
        const { data } = await axios.post(`${API_URL}/auth/token/refresh/`, {
          refresh: refreshToken,
        });
        useAuthStore.getState().setTokens(data.access, data.refresh);
        isRefreshing = false;
        onRefreshed(data.access);
        originalRequest.headers = originalRequest.headers || {};
        originalRequest.headers.Authorization = `Bearer ${data.access}`;
        return api(originalRequest);
      } catch (refreshErr) {
        isRefreshing = false;
        onRefreshFailed(refreshErr);
        useAuthStore.getState().logout();
        return Promise.reject(refreshErr);
      }
    }
    return Promise.reject(error);
  },
);

export default api;

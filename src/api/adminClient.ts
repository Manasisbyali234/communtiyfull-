import axios from 'axios';
import { getApiBaseUrl } from './config';
import { useAdminStore } from '../store/adminStore';

export const adminApiClient = axios.create({
  baseURL: getApiBaseUrl(),
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

adminApiClient.interceptors.request.use(async (config) => {
  if (!useAdminStore.persist.hasHydrated()) {
    await new Promise<void>((resolve) => {
      const unsub = useAdminStore.persist.onFinishHydration(() => { unsub(); resolve(); });
      setTimeout(resolve, 300);
    });
  }
  const token = useAdminStore.getState().token;
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

adminApiClient.interceptors.response.use(
  (r) => r,
  (error) => {
    if (error.response?.status === 401) {
      useAdminStore.getState().logout();
    }
    return Promise.reject(error);
  }
);

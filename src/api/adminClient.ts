import axios from 'axios';
import { getApiBaseUrl } from './config';
import { useAuthStore } from '../store/authStore';
import { useAdminStore } from '../store/adminStore';

export const adminApiClient = axios.create({
  baseURL: getApiBaseUrl(),
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

adminApiClient.interceptors.request.use((config) => {
  // Use authStore token (the regular accessToken which is valid for admin endpoints)
  const token = useAuthStore.getState().token;
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
      useAuthStore.getState().logout();
    }
    return Promise.reject(error);
  }
);

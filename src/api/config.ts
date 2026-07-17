import Constants from 'expo-constants';

const PRODUCTION_API = 'https://community-api.metromindz.com';

const isDev = Constants.expoConfig?.hostUri != null;

const getDevHost = () =>
  Constants.expoConfig?.hostUri?.split(':')[0] ?? 'localhost';

export const getApiBaseUrl = () =>
  isDev ? `http://${getDevHost()}:3000/api/v1` : `${PRODUCTION_API}/api/v1`;

export const getSocketUrl = () =>
  isDev ? `http://${getDevHost()}:3000` : PRODUCTION_API;

// Resolved once at startup
export const API_BASE_URL = getApiBaseUrl();
export const SOCKET_URL = getSocketUrl();

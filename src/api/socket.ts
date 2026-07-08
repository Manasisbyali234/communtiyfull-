/* eslint-disable no-console */
import { io, Socket } from 'socket.io-client';
import { SOCKET_URL } from './client';
import { useAuthStore } from '../store/authStore';

let socket: Socket | null = null;
let initPromise: Promise<Socket | null> | null = null;
type SocketReadyListener = (s: Socket) => void;
const readyListeners: Set<SocketReadyListener> = new Set();

export const onSocketReady = (cb: SocketReadyListener): (() => void) => {
  if (socket?.connected) { cb(socket); return () => {}; }
  readyListeners.add(cb);
  return () => readyListeners.delete(cb);
};

const getValidToken = (): string | null => {
  return useAuthStore.getState().token ?? null;
};

export const initSocket = async () => {
  if (initPromise) return initPromise;
  initPromise = _initSocket().finally(() => { initPromise = null; });
  return initPromise;
};

const _initSocket = async () => {
  const token = getValidToken();
  if (!token) return null;

  if (socket?.connected) return socket;
  if (socket) { socket.disconnect(); socket = null; }

  socket = io(SOCKET_URL, {
    auth: { token },
    transports: ['polling', 'websocket'],
    reconnectionAttempts: 3,
    reconnectionDelay: 3000,
    timeout: 5000,
  });

  socket.on('connect', () => {
    console.log('Connected to socket server');
    readyListeners.forEach(cb => cb(socket!));
    readyListeners.clear();
  });
  socket.on('disconnect', (reason) => {
    console.log('Disconnected from socket server:', reason);
  });

  socket.on('connect_error', (err) => {
    if (err.message === 'Unauthorized') {
      const newToken = useAuthStore.getState().token;
      if (newToken) {
        socket!.auth = { token: newToken };
      } else {
        disconnectSocket();
      }
    }
    // 'xhr poll error' / transport errors are transient — socket will auto-retry
  });

  return socket;
};

export const getSocket = () => socket;

export const disconnectSocket = () => {
  if (socket) { socket.disconnect(); socket = null; }
};

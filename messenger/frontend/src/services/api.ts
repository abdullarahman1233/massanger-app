/// <reference types="vite/client" />
/**
 * Axios API client with JWT interceptors and token refresh
 */
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export const api = axios.create({
  baseURL: API_URL,
  timeout: 15000,
});

// Request interceptor: add auth header
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor: handle token refresh
let isRefreshing = false;
let failedQueue: Array<{ resolve: (token: string) => void; reject: (err: unknown) => void }> = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else if (token) resolve(token);
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) throw new Error('No refresh token');

        const response = await axios.post(`${API_URL}/auth/refresh`, { refreshToken });
        const { accessToken, refreshToken: newRefresh } = response.data;

        localStorage.setItem('accessToken', accessToken);
        localStorage.setItem('refreshToken', newRefresh);

        processQueue(null, accessToken);
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        localStorage.clear();
        window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

// Auth API
export const authApi = {
  register: (email: string, password: string, displayName: string) =>
    api.post('/auth/register', { email, password, displayName }),
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  logout: (refreshToken: string) =>
    api.post('/auth/logout', { refreshToken }),
};

// User API
export const userApi = {
  getMe: () => api.get('/users/me'),
  updateProfile: (data: object) => api.patch('/users/me', data),
  searchUsers: (q: string) => api.get('/users/search', { params: { q } }),
  getUserById: (id: string) => api.get(`/users/${id}`),
};

// Room API
export const roomApi = {
  listRooms: () => api.get('/rooms'),
  createRoom: (type: string, memberIds: string[], name?: string) =>
    api.post('/rooms', { type, memberIds, name }),
  getRoom: (id: string) => api.get(`/rooms/${id}`),
};

// Message API
export const messageApi = {
  getMessages: (roomId: string, before?: string, limit?: number) =>
    api.get(`/messages/room/${roomId}`, { params: { before, limit } }),
  sendMessage: (roomId: string, data: object) =>
    api.post(`/messages/room/${roomId}`, data),
  markRead: (roomId: string) =>
    api.post(`/messages/room/${roomId}/read`),
  deleteMessage: (id: string) =>
    api.delete(`/messages/${id}`),
};

// Upload API
export const uploadApi = {
  getPresignedUrl: (fileName: string, fileType: string) =>
    api.post('/uploads/presign', { fileName, fileType }),
};

// Admin API
export const adminApi = {
  getStats: () => api.get('/admin/stats'),
  listUsers: () => api.get('/admin/users'),
  setBanned: (id: string, banned: boolean) =>
    api.patch(`/admin/users/${id}/ban`, { banned }),
  getModerationQueue: (status?: string) =>
    api.get('/admin/moderation', { params: { status } }),
  resolveModeration: (id: string, action: string) =>
    api.patch(`/admin/moderation/${id}`, { action }),
};

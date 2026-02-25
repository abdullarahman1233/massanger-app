/**
 * Socket.IO client service
 * Manages real-time connection and event handling
 */
import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getSocket(): Socket | null {
  return socket;
}

export function connectSocket(token: string): Socket {
  if (socket?.connected) return socket;

  socket = io(import.meta.env.VITE_SOCKET_URL || '', {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnectionDelay: 1000,
    reconnectionAttempts: 5,
  });

  socket.on('connect', () => console.log('[Socket] Connected:', socket?.id));
  socket.on('disconnect', (reason) => console.log('[Socket] Disconnected:', reason));
  socket.on('connect_error', (err) => console.error('[Socket] Error:', err.message));

  return socket;
}

export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
}

export function joinRoom(roomId: string): void {
  socket?.emit('join_room', roomId);
}

export function sendTypingStart(roomId: string): void {
  socket?.emit('typing_start', { roomId });
}

export function sendTypingStop(roomId: string): void {
  socket?.emit('typing_stop', { roomId });
}

export function markMessagesRead(roomId: string): void {
  socket?.emit('messages_read', { roomId });
}

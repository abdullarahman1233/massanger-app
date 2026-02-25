import { useEffect, useRef, useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { messageApi, roomApi, uploadApi } from '../../services/api';
import { getSocket, sendTypingStart, sendTypingStop, markMessagesRead, joinRoom } from '../../services/socket';
import { Message, Room, User } from '../../types';
import { MessageBubble } from './MessageBubble';
import { useDropzone } from 'react-dropzone';
import { v4 as uuidv4 } from 'uuid';

interface ChatWindowProps {
  roomId: string;
  currentUser: User;
}

export function ChatWindow({ roomId, currentUser }: ChatWindowProps) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queryClient = useQueryClient();

  const { data: room } = useQuery<Room>({
    queryKey: ['room', roomId],
    queryFn: () => roomApi.getRoom(roomId).then(r => r.data),
  });

  // Load initial messages
  useEffect(() => {
    messageApi.getMessages(roomId).then(r => {
      setMessages(r.data);
      setTimeout(() => scrollToBottom(), 100);
    });
  }, [roomId]);

  // Socket events
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    joinRoom(roomId);
    markMessagesRead(roomId);

    const onNewMessage = (msg: Message) => {
      setMessages(prev => {
        // Remove optimistic duplicate if exists
        const filtered = prev.filter(m => !m.isOptimistic || m.content !== msg.content);
        return [...filtered, msg];
      });
      if (msg.sender_id !== currentUser.id) {
        markMessagesRead(roomId);
      }
      scrollToBottom();
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
    };

    const onTypingStart = ({ userId, roomId: rid }: { userId: string; roomId: string }) => {
      if (rid === roomId && userId !== currentUser.id) {
        setTypingUsers(prev => prev.includes(userId) ? prev : [...prev, userId]);
      }
    };

    const onTypingStop = ({ userId, roomId: rid }: { userId: string; roomId: string }) => {
      if (rid === roomId) {
        setTypingUsers(prev => prev.filter(id => id !== userId));
      }
    };

    const onStatusUpdate = ({ messageId, status }: { messageId: string; status: string }) => {
      setMessages(prev =>
        prev.map(m => m.id === messageId ? { ...m, status: status as Message['status'] } : m)
      );
    };

    socket.on('new_message', onNewMessage);
    socket.on('typing_start', onTypingStart);
    socket.on('typing_stop', onTypingStop);
    socket.on('message_status_updated', onStatusUpdate);

    return () => {
      socket.off('new_message', onNewMessage);
      socket.off('typing_start', onTypingStart);
      socket.off('typing_stop', onTypingStop);
      socket.off('message_status_updated', onStatusUpdate);
    };
  }, [roomId, currentUser.id]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!text.trim() && !sending) return;
    const content = text.trim();
    if (!content) return;

    setText('');
    setSending(true);
    sendTypingStop(roomId);

    // Optimistic update
    const optimistic: Message = {
      id: uuidv4(),
      roomId,
      senderId: currentUser.id,
      senderName: currentUser.displayName,
      content,
      status: 'sent',
      createdAt: new Date().toISOString(),
      isOptimistic: true,
    };
    setMessages(prev => [...prev, optimistic]);
    scrollToBottom();

    try {
      await messageApi.sendMessage(roomId, { content });
    } catch (err) {
      // Remove optimistic on error
      setMessages(prev => prev.filter(m => m.id !== optimistic.id));
      setText(content); // Restore text
    } finally {
      setSending(false);
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setText(e.target.value);
    sendTypingStart(roomId);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => sendTypingStop(roomId), 2000);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // File upload
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    for (const file of acceptedFiles) {
      const isImage = file.type.startsWith('image/');
      const presignRes = await uploadApi.getPresignedUrl(file.name, file.type);
      const { uploadUrl, publicUrl } = presignRes.data;

      // Upload to S3/MinIO
      await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
      });

      // Send message with attachment
      await messageApi.sendMessage(roomId, {
        attachmentUrl: publicUrl,
        attachmentType: isImage ? 'image' : 'file',
      });
    }
  }, [roomId]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    noClick: true,
  });

  const getRoomDisplayName = () => {
    if (!room) return '';
    if (room.type === 'direct' && room.members) {
      const other = room.members.find(m => m.id !== currentUser.id);
      return other?.display_name || room.name || 'Direct Message';
    }
    return room.name || 'Group Chat';
  };

  return (
    <div
      {...getRootProps()}
      className={`flex flex-col h-full ${isDragActive ? 'bg-blue-50' : ''}`}
    >
      <input {...getInputProps()} />

      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 flex items-center gap-3 bg-white flex-shrink-0">
        <div className="h-9 w-9 rounded-full bg-blue-500 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
          {(getRoomDisplayName() || '?').charAt(0).toUpperCase()}
        </div>
        <div>
          <h3 className="font-semibold text-gray-900">{getRoomDisplayName()}</h3>
          {room?.type === 'group' && (
            <p className="text-xs text-gray-500">{room.members?.length || 0} members</p>
          )}
        </div>
        {isDragActive && (
          <div className="ml-auto text-blue-500 text-sm font-medium">Drop file to send</div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-1">
        {messages.map((msg, idx) => {
          const prevMsg = messages[idx - 1];
          const showAvatar = !prevMsg || prevMsg.sender_id !== msg.sender_id || prevMsg.senderId !== msg.senderId;
          return (
            <MessageBubble
              key={msg.id}
              message={msg}
              isOwn={(msg.sender_id || msg.senderId) === currentUser.id}
              showAvatar={showAvatar}
            />
          );
        })}

        {typingUsers.length > 0 && (
          <div className="flex items-center gap-2 text-gray-400 text-sm py-1">
            <div className="flex gap-1">
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
            <span>{typingUsers.length === 1 ? 'Someone is' : 'People are'} typing...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="px-6 py-4 border-t border-gray-200 bg-white flex-shrink-0">
        <form onSubmit={handleSend} className="flex items-center gap-3">
          <label className="cursor-pointer text-gray-400 hover:text-gray-600 flex-shrink-0" title="Attach file">
            <input
              type="file"
              className="hidden"
              accept="image/*,application/pdf,text/plain"
              onChange={e => e.target.files && onDrop(Array.from(e.target.files))}
            />
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
          </label>

          <input
            type="text"
            value={text}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-gray-100 rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Type a message..."
            disabled={sending}
          />

          <button
            type="submit"
            disabled={!text.trim() || sending}
            className="bg-blue-600 text-white rounded-full w-9 h-9 flex items-center justify-center hover:bg-blue-700 transition-colors disabled:opacity-50 flex-shrink-0"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
}

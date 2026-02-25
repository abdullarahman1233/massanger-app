export interface User {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  bio?: string | null;
  status: 'online' | 'away' | 'busy' | 'offline';
  role: 'user' | 'admin' | 'moderator';
  lastSeen?: string;
}

export interface Room {
  id: string;
  type: 'direct' | 'group';
  name: string | null;
  avatarUrl?: string | null;
  members?: RoomMember[];
  lastMessageContent?: string | null;
  lastMessageAt?: string | null;
  unreadCount?: number;
  otherUser?: User;
}

export interface RoomMember {
  id: string;
  display_name: string;
  avatar_url: string | null;
  status: string;
  role: 'admin' | 'member';
}

export interface Message {
  id: string;
  roomId: string;
  room_id?: string;
  senderId: string;
  sender_id?: string;
  senderName?: string;
  sender_name?: string;
  senderAvatar?: string | null;
  sender_avatar?: string | null;
  content: string | null;
  attachmentUrl?: string | null;
  attachment_url?: string | null;
  attachmentType?: 'image' | 'file' | null;
  attachment_type?: string | null;
  status: 'sent' | 'delivered' | 'read';
  replyToId?: string | null;
  reply_to_id?: string | null;
  expiresAt?: string | null;
  expires_at?: string | null;
  createdAt?: string;
  created_at?: string;
  isOptimistic?: boolean;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  user: User;
}

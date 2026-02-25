import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { roomApi, userApi } from '../../services/api';
import { Room, User } from '../../types';
import { getSocket } from '../../services/socket';
import { NewConversationModal } from './NewConversationModal';
import { formatDistanceToNow } from 'date-fns';

interface RoomListProps {
  selectedRoomId?: string;
}

export function RoomList({ selectedRoomId }: RoomListProps) {
  const navigate = useNavigate();
  const [showNewChat, setShowNewChat] = useState(false);

  const { data: rooms = [], refetch } = useQuery<Room[]>({
    queryKey: ['rooms'],
    queryFn: () => roomApi.listRooms().then(r => r.data),
    refetchInterval: 30000,
  });

  // Listen for new messages to update room list
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const handler = () => refetch();
    socket.on('new_message', handler);
    return () => { socket.off('new_message', handler); };
  }, [refetch]);

  const getRoomName = (room: Room) => {
    if (room.type === 'direct' && room.otherUser) {
      return room.otherUser.display_name || room.name || 'Direct Message';
    }
    return room.name || 'Group Chat';
  };

  const getRoomAvatar = (room: Room) => {
    if (room.type === 'direct' && room.otherUser) {
      const name = room.otherUser.display_name || '?';
      if (room.otherUser.avatar_url) {
        return <img src={room.otherUser.avatar_url} alt={name} className="h-10 w-10 rounded-full object-cover" />;
      }
      return (
        <div className="h-10 w-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-semibold text-sm">
          {name.charAt(0).toUpperCase()}
        </div>
      );
    }
    return (
      <div className="h-10 w-10 rounded-full bg-purple-500 flex items-center justify-center text-white font-semibold text-sm">
        {(room.name || 'G').charAt(0).toUpperCase()}
      </div>
    );
  };

  const getPresenceColor = (room: Room) => {
    if (room.type === 'direct' && room.otherUser) {
      const status = room.otherUser.status;
      if (status === 'online') return 'bg-green-400';
      if (status === 'away') return 'bg-yellow-400';
      return 'bg-gray-400';
    }
    return null;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-900 text-lg">Messages</h2>
          <button
            onClick={() => setShowNewChat(true)}
            className="bg-blue-600 text-white rounded-full w-8 h-8 flex items-center justify-center hover:bg-blue-700 transition-colors text-xl"
            title="New conversation"
          >
            +
          </button>
        </div>
      </div>

      {/* Room list */}
      <div className="flex-1 overflow-y-auto">
        {rooms.length === 0 && (
          <div className="text-center text-gray-400 p-8">
            <p>No conversations yet</p>
            <button
              onClick={() => setShowNewChat(true)}
              className="mt-2 text-blue-500 hover:text-blue-600 text-sm"
            >
              Start one!
            </button>
          </div>
        )}

        {rooms.map((room: Room) => {
          const presenceColor = getPresenceColor(room);
          return (
            <button
              key={room.id}
              onClick={() => navigate(`/room/${room.id}`)}
              className={`w-full text-left p-3 flex items-center gap-3 hover:bg-gray-50 transition-colors border-b border-gray-100 ${
                selectedRoomId === room.id ? 'bg-blue-50 border-r-2 border-r-blue-600' : ''
              }`}
            >
              <div className="relative flex-shrink-0">
                {getRoomAvatar(room)}
                {presenceColor && (
                  <div className={`absolute bottom-0 right-0 w-3 h-3 ${presenceColor} rounded-full border-2 border-white`} />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-900 text-sm truncate">
                    {getRoomName(room)}
                  </span>
                  {room.lastMessageAt && (
                    <span className="text-xs text-gray-400 ml-2 flex-shrink-0">
                      {formatDistanceToNow(new Date(room.lastMessageAt), { addSuffix: false })}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-gray-500 truncate">
                    {room.lastMessageContent || 'No messages yet'}
                  </p>
                  {(room.unreadCount || 0) > 0 && (
                    <span className="ml-2 bg-blue-600 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[1.25rem] text-center flex-shrink-0">
                      {room.unreadCount}
                    </span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {showNewChat && (
        <NewConversationModal
          onClose={() => setShowNewChat(false)}
          onCreated={(roomId) => {
            refetch();
            setShowNewChat(false);
            navigate(`/room/${roomId}`);
          }}
        />
      )}
    </div>
  );
}

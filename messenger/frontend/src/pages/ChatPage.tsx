import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';
import { connectSocket, disconnectSocket } from '../services/socket';
import { RoomList } from '../components/chat/RoomList';
import { ChatWindow } from '../components/chat/ChatWindow';
import { Sidebar } from '../components/chat/Sidebar';

export function ChatPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const user = useAuthStore(s => s.user);
  const accessToken = useAuthStore(s => s.accessToken);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (accessToken) {
      connectSocket(accessToken);
    }
    return () => {
      disconnectSocket();
    };
  }, [accessToken]);

  if (!user) return null;

  return (
    <div className="h-screen flex bg-white overflow-hidden">
      {/* Sidebar */}
      <Sidebar
        user={user}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Room list */}
      <div className="w-72 border-r border-gray-200 flex flex-col bg-white flex-shrink-0">
        <RoomList selectedRoomId={roomId} />
      </div>

      {/* Chat window */}
      <div className="flex-1 flex flex-col min-w-0">
        {roomId ? (
          <ChatWindow roomId={roomId} currentUser={user} />
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            <div className="text-center">
              <div className="text-6xl mb-4">💬</div>
              <p className="text-xl font-medium text-gray-600">Select a conversation</p>
              <p className="text-sm mt-2">Choose from your existing conversations or start a new one</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

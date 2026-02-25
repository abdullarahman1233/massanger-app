import { Link, useNavigate } from 'react-router-dom';
import { User } from '../../types';
import { useAuthStore } from '../../store/auth.store';
import { authApi } from '../../services/api';

interface SidebarProps {
  user: User;
  isOpen: boolean;
  onClose: () => void;
}

function Avatar({ user, size = 'md' }: { user: User; size?: 'sm' | 'md' }) {
  const sizeClass = size === 'sm' ? 'h-8 w-8 text-xs' : 'h-10 w-10 text-sm';
  if (user.avatarUrl) {
    return <img src={user.avatarUrl} alt={user.displayName} className={`${sizeClass} rounded-full object-cover`} />;
  }
  return (
    <div className={`${sizeClass} rounded-full bg-blue-600 flex items-center justify-center text-white font-semibold`}>
      {user.displayName.charAt(0).toUpperCase()}
    </div>
  );
}

export function Sidebar({ user }: SidebarProps) {
  const navigate = useNavigate();
  const clearAuth = useAuthStore(s => s.clearAuth);
  const refreshToken = useAuthStore(s => s.refreshToken);

  const handleLogout = async () => {
    try {
      if (refreshToken) await authApi.logout(refreshToken);
    } catch {
      // ignore
    }
    clearAuth();
    navigate('/login');
  };

  return (
    <div className="w-16 bg-gray-900 flex flex-col items-center py-4 space-y-4">
      {/* Logo */}
      <div className="text-2xl">💬</div>

      <div className="flex-1" />

      {/* Profile */}
      <Link to="/profile" title="Profile">
        <Avatar user={user} size="sm" />
      </Link>

      {/* Admin link */}
      {user.role === 'admin' && (
        <Link
          to="/admin"
          title="Admin"
          className="text-gray-400 hover:text-white text-xl p-2 rounded-lg hover:bg-gray-700"
        >
          ⚙️
        </Link>
      )}

      {/* Logout */}
      <button
        onClick={handleLogout}
        title="Logout"
        className="text-gray-400 hover:text-white text-xl p-2 rounded-lg hover:bg-gray-700"
      >
        🚪
      </button>
    </div>
  );
}

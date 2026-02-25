import { useState } from 'react';
import { userApi, roomApi } from '../../services/api';
import { User } from '../../types';
import { useAuthStore } from '../../store/auth.store';

interface Props {
  onClose: () => void;
  onCreated: (roomId: string) => void;
}

export function NewConversationModal({ onClose, onCreated }: Props) {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<User[]>([]);
  const [selected, setSelected] = useState<User[]>([]);
  const [groupName, setGroupName] = useState('');
  const [loading, setLoading] = useState(false);
  const currentUser = useAuthStore(s => s.user);

  const handleSearch = async (q: string) => {
    setSearch(q);
    if (q.length < 1) { setResults([]); return; }
    const res = await userApi.searchUsers(q);
    setResults(res.data.filter((u: User) => u.id !== currentUser?.id));
  };

  const toggleSelect = (user: User) => {
    setSelected(prev =>
      prev.find(u => u.id === user.id)
        ? prev.filter(u => u.id !== user.id)
        : [...prev, user]
    );
  };

  const handleCreate = async () => {
    if (selected.length === 0) return;
    setLoading(true);
    try {
      const type = selected.length === 1 ? 'direct' : 'group';
      const memberIds = selected.map(u => u.id);
      const res = await roomApi.createRoom(type, memberIds, groupName || undefined);
      onCreated(res.data.id);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-lg">New Conversation</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>

        {selected.length > 1 && (
          <input
            type="text"
            value={groupName}
            onChange={e => setGroupName(e.target.value)}
            className="input mb-3"
            placeholder="Group name (optional)"
          />
        )}

        <input
          type="text"
          value={search}
          onChange={e => handleSearch(e.target.value)}
          className="input mb-3"
          placeholder="Search users by name or email..."
          autoFocus
        />

        {selected.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {selected.map(u => (
              <span key={u.id} className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-sm flex items-center gap-1">
                {u.displayName}
                <button onClick={() => toggleSelect(u)} className="hover:text-blue-600">✕</button>
              </span>
            ))}
          </div>
        )}

        <div className="max-h-48 overflow-y-auto space-y-1 mb-4">
          {results.map(user => (
            <button
              key={user.id}
              onClick={() => toggleSelect(user)}
              className={`w-full text-left p-2 rounded-lg flex items-center gap-3 hover:bg-gray-50 ${
                selected.find(u => u.id === user.id) ? 'bg-blue-50' : ''
              }`}
            >
              <div className="h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
                {user.displayName.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-medium">{user.displayName}</p>
                <p className="text-xs text-gray-500">{user.email}</p>
              </div>
              {selected.find(u => u.id === user.id) && <span className="ml-auto text-blue-600">✓</span>}
            </button>
          ))}
        </div>

        <button
          onClick={handleCreate}
          className="btn-primary w-full"
          disabled={selected.length === 0 || loading}
        >
          {loading ? 'Creating...' : selected.length === 1 ? 'Open Conversation' : 'Create Group'}
        </button>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';
import { userApi } from '../services/api';

const STATUS_OPTIONS = [
  { value: 'online', label: '🟢 Online' },
  { value: 'away', label: '🟡 Away' },
  { value: 'busy', label: '🔴 Busy' },
  { value: 'offline', label: '⚫ Offline' },
];

export function ProfilePage() {
  const user = useAuthStore(s => s.user);
  const updateUser = useAuthStore(s => s.updateUser);
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [status, setStatus] = useState<"online" | "away" | "busy" | "offline">(user?.status || 'online');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await userApi.updateProfile({ displayName, bio, status });
      updateUser(res.data);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-md">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate('/')} className="text-gray-400 hover:text-gray-600">←</button>
          <h1 className="text-xl font-bold">Your Profile</h1>
        </div>

        {/* Avatar */}
        <div className="flex justify-center mb-6">
          <div className="h-20 w-20 rounded-full bg-blue-600 flex items-center justify-center text-white text-3xl font-bold">
            {(user?.displayName || '?').charAt(0).toUpperCase()}
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Display Name</label>
            <input
              type="text"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              className="input"
              maxLength={50}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Bio</label>
            <textarea
              value={bio}
              onChange={e => setBio(e.target.value)}
              className="input resize-none"
              rows={3}
              maxLength={200}
              placeholder="Tell people about yourself..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={status}
              onChange={e => setStatus(e.target.value as "online" | "away" | "busy" | "offline")}
              className="input"
            >
              {STATUS_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-600">
            <p><strong>Email:</strong> {user?.email}</p>
            <p><strong>Role:</strong> {user?.role}</p>
          </div>

          <button type="submit" className="btn-primary w-full" disabled={saving}>
            {saved ? '✓ Saved!' : saving ? 'Saving...' : 'Save Changes'}
          </button>
        </form>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../services/api';

export function AdminPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'stats' | 'users' | 'moderation'>('stats');

  const { data: stats } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: () => adminApi.getStats().then(r => r.data),
    enabled: activeTab === 'stats',
  });

  const { data: users = [] } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => adminApi.listUsers().then(r => r.data),
    enabled: activeTab === 'users',
  });

  const { data: queue = [] } = useQuery({
    queryKey: ['moderation-queue'],
    queryFn: () => adminApi.getModerationQueue('pending').then(r => r.data),
    enabled: activeTab === 'moderation',
  });

  const banMutation = useMutation({
    mutationFn: ({ id, banned }: { id: string; banned: boolean }) =>
      adminApi.setBanned(id, banned),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-users'] }),
  });

  const resolveMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: string }) =>
      adminApi.resolveModeration(id, action),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['moderation-queue'] }),
  });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4">
        <button onClick={() => navigate('/')} className="text-gray-400 hover:text-gray-600">←</button>
        <h1 className="text-xl font-bold">Admin Dashboard</h1>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200 px-6">
        <div className="flex gap-6">
          {[
            { id: 'stats', label: 'Overview' },
            { id: 'users', label: 'Users' },
            { id: 'moderation', label: 'Moderation' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-6 max-w-5xl mx-auto">
        {/* Stats */}
        {activeTab === 'stats' && stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Total Users', value: stats.totalUsers, icon: '👥' },
              { label: 'Total Messages', value: stats.totalMessages, icon: '💬' },
              { label: 'Total Rooms', value: stats.totalRooms, icon: '🏠' },
              { label: 'Pending Moderation', value: stats.pendingModeration, icon: '⚠️' },
            ].map(stat => (
              <div key={stat.label} className="bg-white rounded-xl p-5 shadow-sm">
                <div className="text-3xl mb-2">{stat.icon}</div>
                <div className="text-2xl font-bold">{stat.value}</div>
                <div className="text-sm text-gray-500">{stat.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Users */}
        {activeTab === 'users' && (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">User</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Role</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user: { id: string; email: string; display_name: string; role: string; is_banned: boolean; is_active: boolean }) => (
                  <tr key={user.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div>
                        <div className="font-medium">{user.display_name}</div>
                        <div className="text-gray-500">{user.email}</div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        user.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-700'
                      }`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {user.is_banned ? (
                        <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs">Banned</span>
                      ) : user.is_active ? (
                        <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs">Active</span>
                      ) : (
                        <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs">Inactive</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {user.role !== 'admin' && (
                        <button
                          onClick={() => banMutation.mutate({ id: user.id, banned: !user.is_banned })}
                          className={`text-xs px-3 py-1 rounded-lg ${
                            user.is_banned
                              ? 'bg-green-100 text-green-700 hover:bg-green-200'
                              : 'bg-red-100 text-red-700 hover:bg-red-200'
                          }`}
                        >
                          {user.is_banned ? 'Unban' : 'Ban'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Moderation queue */}
        {activeTab === 'moderation' && (
          <div className="space-y-4">
            {queue.length === 0 && (
              <div className="bg-white rounded-xl p-8 text-center text-gray-500">
                No pending items in the moderation queue ✓
              </div>
            )}
            {queue.map((item: { id: string; reason: string; sender_email: string; content: string; created_at: string }) => (
              <div key={item.id} className="bg-white rounded-xl shadow-sm p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="text-xs text-gray-500 mb-1">
                      <strong>{item.sender_email}</strong> · {item.reason}
                    </div>
                    <p className="text-sm bg-gray-50 rounded p-2">{item.content}</p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => resolveMutation.mutate({ id: item.id, action: 'approve' })}
                      className="text-xs px-3 py-1 bg-green-100 text-green-700 hover:bg-green-200 rounded-lg"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => resolveMutation.mutate({ id: item.id, action: 'delete' })}
                      className="text-xs px-3 py-1 bg-red-100 text-red-700 hover:bg-red-200 rounded-lg"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

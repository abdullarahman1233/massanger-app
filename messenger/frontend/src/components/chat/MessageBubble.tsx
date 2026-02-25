import { Message } from '../../types';
import { format } from 'date-fns';

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
  showAvatar: boolean;
}

function StatusIcon({ status }: { status: string }) {
  if (status === 'sent') return <span className="text-gray-400" title="Sent">✓</span>;
  if (status === 'delivered') return <span className="text-gray-400" title="Delivered">✓✓</span>;
  if (status === 'read') return <span className="text-blue-500" title="Read">✓✓</span>;
  return null;
}

export function MessageBubble({ message, isOwn, showAvatar }: MessageBubbleProps) {
  const createdAt = message.created_at || message.createdAt;
  const senderName = message.sender_name || message.senderName;
  const attachmentUrl = message.attachment_url || message.attachmentUrl;
  const attachmentType = message.attachment_type || message.attachmentType;

  return (
    <div className={`flex items-end gap-2 ${isOwn ? 'flex-row-reverse' : 'flex-row'} ${showAvatar ? 'mt-3' : 'mt-0.5'}`}>
      {/* Avatar */}
      {!isOwn && (
        <div className="w-7 flex-shrink-0">
          {showAvatar && (
            <div className="h-7 w-7 rounded-full bg-gray-400 flex items-center justify-center text-white text-xs font-semibold">
              {(senderName || '?').charAt(0).toUpperCase()}
            </div>
          )}
        </div>
      )}

      <div className={`max-w-xs lg:max-w-md xl:max-w-lg ${isOwn ? 'items-end' : 'items-start'} flex flex-col`}>
        {/* Sender name for group chats */}
        {!isOwn && showAvatar && senderName && (
          <span className="text-xs text-gray-500 mb-1 ml-1">{senderName}</span>
        )}

        <div
          className={`px-4 py-2 rounded-2xl ${
            isOwn
              ? 'bg-blue-600 text-white rounded-br-sm'
              : 'bg-gray-100 text-gray-900 rounded-bl-sm'
          } ${message.isOptimistic ? 'opacity-70' : ''}`}
        >
          {/* Image attachment */}
          {attachmentUrl && attachmentType === 'image' && (
            <img
              src={attachmentUrl}
              alt="Attachment"
              className="max-w-full rounded-lg mb-1"
              style={{ maxHeight: '200px', objectFit: 'cover' }}
            />
          )}

          {/* File attachment */}
          {attachmentUrl && attachmentType === 'file' && (
            <a
              href={attachmentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex items-center gap-2 text-sm ${isOwn ? 'text-blue-100 hover:text-white' : 'text-blue-600 hover:text-blue-700'}`}
            >
              <span>📎</span>
              <span className="underline">Attachment</span>
            </a>
          )}

          {/* Text content */}
          {message.content && (
            <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
          )}
        </div>

        {/* Timestamp and status */}
        <div className={`flex items-center gap-1 mt-0.5 ${isOwn ? 'flex-row-reverse' : ''}`}>
          {createdAt && (
            <span className="text-xs text-gray-400">
              {format(new Date(createdAt), 'HH:mm')}
            </span>
          )}
          {isOwn && (
            <span className="text-xs">
              <StatusIcon status={message.status} />
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

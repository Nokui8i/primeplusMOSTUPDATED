'use client';

import { useState } from 'react';
import { useNotifications } from '@/lib/notifications';
import { FiBell } from 'react-icons/fi';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/hooks/useAuth';

export default function NotificationDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const { notifications, unreadCount, markAsRead, markAllAsRead, loading } = useNotifications();
  const { user } = useAuth();

  if (!user) return null;

  const handleMarkAllRead = async () => {
    await markAllAsRead();
    setIsOpen(false);
  };

  const handleNotificationClick = async (notificationId: string) => {
    await markAsRead(notificationId);
  };

  const renderNotificationContent = (notification: any) => {
    switch (notification.type) {
      case 'like':
        return (
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0">
              <Image
                src={notification.fromUser?.photoURL || '/default-avatar.png'}
                alt={notification.fromUser?.displayName || 'User'}
                width={40}
                height={40}
                className="rounded-full"
                sizes="40px"
                priority={notification.id === notifications[0]?.id}
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-900">
                <Link href={`/${notification.fromUser?.username}`} className="font-medium hover:underline">
                  {notification.fromUser?.displayName || 'Someone'}
                </Link>
                {' liked your post'}
              </p>
              {notification.data?.postContent && (
                <p className="mt-1 text-sm text-gray-500 truncate">
                  "{notification.data.postContent}..."
                </p>
              )}
              <p className="mt-1 text-xs text-gray-500">
                {formatDistanceToNow(notification.createdAt.toDate(), { addSuffix: true })}
              </p>
            </div>
          </div>
        );
      default:
        return (
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0">
              <Image
                src={notification.fromUser?.photoURL || '/default-avatar.png'}
                alt={notification.fromUser?.displayName || 'User'}
                width={40}
                height={40}
                className="rounded-full"
                sizes="40px"
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-900">
                <span className="font-medium">{notification.fromUser?.displayName || 'Someone'}</span>{' '}
                {notification.data?.message || notification.data?.text || 'sent you a notification'}
              </p>
              <p className="mt-1 text-xs text-gray-500">
                {formatDistanceToNow(notification.createdAt.toDate(), { addSuffix: true })}
              </p>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 hover:text-gray-900 focus:outline-none"
      >
        <FiBell className="w-6 h-6" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-[#E91E63] rounded-full">
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg py-1 z-50">
          <div className="px-4 py-2 border-b border-gray-200 flex justify-between items-center">
            <h3 className="text-lg font-semibold text-gray-900">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-sm text-[#E91E63] hover:text-[#FF4081] font-medium"
              >
                Mark all as read
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <div className="p-4 text-center text-gray-500">Loading...</div>
            ) : notifications.length === 0 ? (
              <div className="p-4 text-center text-gray-500">No notifications yet</div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`px-4 py-3 hover:bg-gray-50 cursor-pointer ${
                    !notification.read ? 'bg-[#FF80AB]/5' : ''
                  }`}
                  onClick={() => handleNotificationClick(notification.id)}
                >
                  {renderNotificationContent(notification)}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
} 
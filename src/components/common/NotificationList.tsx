'use client';

import { useNotification } from '@/contexts/NotificationContext';
import { NotificationContainer } from './Notification';

export function NotificationList() {
  const { notifications, removeNotification } = useNotification();

  return (
    <>
      {notifications.map((notification) => (
        <NotificationContainer
          key={notification.id}
          type={notification.type}
          message={notification.message}
          onClose={() => removeNotification(notification.id)}
        />
      ))}
    </>
  );
} 
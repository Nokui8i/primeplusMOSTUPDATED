"use client";

import { useState, useEffect } from 'react';
import { Bell } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/lib/auth';
import { useNotifications, type Notification } from '@/lib/notifications';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';

export function NotificationsDropdown() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [hasUnread, setHasUnread] = useState(false);

  useEffect(() => {
    if (!user) return;

    const unsubscribe = useNotifications(user.uid, (newNotifications) => {
      setNotifications(newNotifications);
      setHasUnread(newNotifications.length > 0);
    });

    return () => unsubscribe();
  }, [user]);

  const getNotificationText = (notification: Notification) => {
    switch (notification.type) {
      case 'follow':
        return 'started following you';
      default:
        return '';
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {hasUnread && (
            <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-primary" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        {notifications.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            No new notifications
          </div>
        ) : (
          notifications.map((notification) => (
            <DropdownMenuItem key={notification.id} className="p-4 focus:bg-accent">
              <Link
                href={`/${notification.fromUser?.username || notification.fromUserId}`}
                className="flex items-center space-x-4"
              >
                <Avatar className="h-8 w-8">
                  <AvatarImage src={notification.fromUser?.photoURL} />
                  <AvatarFallback>
                    {notification.fromUser?.displayName?.[0]}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 space-y-1">
                  <p className="text-sm">
                    <span className="font-medium">
                      {notification.fromUser?.displayName}
                    </span>{' '}
                    {getNotificationText(notification)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNow(notification.createdAt, {
                      addSuffix: true,
                    })}
                  </p>
                </div>
              </Link>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
} 
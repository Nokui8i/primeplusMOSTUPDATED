"use client";

import { useState, useEffect } from 'react';
import { Bell, Heart, Users, Image, MessageSquare, FileText, Clock, BellRing, Trash2, Terminal, MessageCircle, UserPlus, AtSign } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/hooks/useAuth';
import { useNotifications, type Notification, type NotificationData } from '@/lib/notifications';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { toast } from 'react-hot-toast';
import { db } from '@/lib/firebase';

type NotificationWithTag = Notification & { type: 'like' | 'comment' | 'follow' | 'tag' | 'mention' };

interface NotificationTagFix {
  type: 'like' | 'comment' | 'follow' | 'tag' | 'mention';
  [key: string]: any;
}

type NotificationWithMetadata = Notification & { metadata?: Record<string, any>; message?: string };

export function NotificationsDropdown() {
  const { user } = useAuth();
  const { notifications, unreadCount, loading, markAsRead, markAllAsRead, deleteNotification, deleteAllNotifications } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState('all');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [notificationToDelete, setNotificationToDelete] = useState<string | null>(null);
  const [deleteAllDialogOpen, setDeleteAllDialogOpen] = useState(false);
  const router = useRouter();

  // Mark all notifications as read when opening the dropdown
  useEffect(() => {
    if (isOpen && unreadCount > 0) {
      markAllAsRead();
    }
  }, [isOpen, unreadCount, markAllAsRead]);

  // Split notifications into New and Earlier
  const now = new Date();
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  
  const filteredNotifications = filter === 'all' 
    ? (notifications as NotificationWithMetadata[]).slice(0, 10) // Only show first 10 notifications
    : (notifications as NotificationWithMetadata[]).filter(n => !n.read).slice(0, 10); // Only show first 10 unread notifications

  const getNotificationIcon = (notification: NotificationTagFix) => {
    switch (notification.type) {
      case 'like':
        return <Heart className="h-4 w-4 text-red-500" />;
      case 'comment':
        return notification.data?.isCommand ? (
          <MessageSquare className="h-4 w-4 text-blue-500" />
        ) : (
          <MessageCircle className="h-4 w-4 text-blue-500" />
        );
      case 'follow':
        return <UserPlus className="h-4 w-4 text-green-500" />;
      case 'tag':
      case 'mention':
        return <AtSign className="h-4 w-4 text-purple-500" />;
      default:
        return <Bell className="h-4 w-4" />;
    }
  };

  const getNotificationText = (notification: NotificationTagFix) => {
    switch (notification.type) {
      case 'like':
        return 'liked your post';
      case 'comment':
        return notification.data?.isCommand ? 'command on your post' : 'commented on your post';
      case 'follow':
        return 'started following you';
      case 'tag':
      case 'mention':
        return 'tagged you';
      default:
        return 'sent you a notification';
    }
  };

  const getNotificationPreview = (notification: Notification) => {
    if (notification.data?.text) {
      return notification.data.text.length > 100 
        ? notification.data.text.substring(0, 100) + '...'
        : notification.data.text;
    }
    return '';
  };

  const handleNotificationClick = async (notification: NotificationTagFix) => {
    let url = '';
    if (notification.type === 'follow' && notification.data?.userId) {
      url = `/profile/${notification.data.userId}`;
      router.push(url);
    } else if (notification.type === 'comment' && notification.data?.postId) {
      url = `/post/${notification.data.postId}?showComments=true`;
      router.push(url);
    } else if (notification.type === 'like' && notification.data?.postId) {
      url = `/post/${notification.data.postId}`;
      router.push(url);
    } else if ((notification.type === 'tag' || notification.type === 'mention') && notification.data?.postId && notification.data?.commentId) {
      url = `/post/${notification.data.postId}?commentId=${notification.data.commentId}&highlight=true`;
      router.push(url);
    } else if ((notification.type === 'tag' || notification.type === 'mention') && notification.data?.postId) {
      url = `/post/${notification.data.postId}`;
      router.push(url);
    }
    setIsOpen(false); // Close the dropdown after navigation
  };

  const handleDeleteNotification = async (notificationId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault(); // Prevent any default behavior
    try {
      await deleteNotification(notificationId);
      toast.success('Notification deleted');
    } catch (error) {
      console.error('Error deleting notification:', error);
      toast.error('Failed to delete notification');
    }
  };

  const handleDeleteAllNotifications = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault(); // Prevent any default behavior
    try {
      await deleteAllNotifications();
      toast.success('All notifications deleted');
    } catch (error) {
      console.error('Error deleting all notifications:', error);
      toast.error('Failed to delete notifications');
    }
  };

  const confirmDeleteNotification = async () => {
    if (notificationToDelete) {
      try {
        await deleteNotification(notificationToDelete);
        setDeleteDialogOpen(false);
        setNotificationToDelete(null);
        toast.success('Notification deleted');
      } catch (error) {
        console.error('Error deleting notification:', error);
        toast.error('Failed to delete notification');
      }
    }
  };

  const confirmDeleteAllNotifications = async () => {
    try {
      await deleteAllNotifications();
      setDeleteAllDialogOpen(false);
      toast.success('All notifications deleted');
    } catch (error) {
      console.error('Error deleting all notifications:', error);
      toast.error('Failed to delete notifications');
    }
  };

  return (
    <>
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <div 
            className="notification" 
            data-count={unreadCount > 0 ? unreadCount : ''}
            style={{ position: 'relative' }}
          >
            <div className="bell-container">
              <div className="bell"></div>
            </div>
          </div>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-80 max-h-[500px] bg-white border border-gray-200 shadow-lg">
          <div className="px-4 py-3 border-b border-gray-200 flex justify-between items-center">
            <h3 className="text-base font-semibold text-gray-900">Notifications</h3>
            <div className="flex items-center space-x-2">
              {notifications.length > 0 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-gray-500 hover:text-red-500"
                  onClick={handleDeleteAllNotifications}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
              <Link href="/notifications" className="text-xs text-blue-600 hover:text-blue-700 font-medium">
                See all notifications
              </Link>
            </div>
          </div>
          <div className="px-4 py-2 border-b border-gray-200">
            <Tabs value={filter} onValueChange={setFilter} className="w-full">
              <TabsList className="grid w-full grid-cols-2 bg-gray-100">
                <TabsTrigger value="all" className="text-xs text-gray-600 data-[state=active]:bg-white data-[state=active]:text-blue-600">All</TabsTrigger>
                <TabsTrigger value="unread" className="text-xs text-gray-600 data-[state=active]:bg-white data-[state=active]:text-blue-600">Unread</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          
          {loading ? (
            <div className="p-4 text-center text-sm text-gray-500">
              Loading...
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="p-4 text-center text-sm text-gray-500">
              No notifications
            </div>
          ) : (
            <div className="max-h-[400px] overflow-y-auto">
              {filteredNotifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0 ${
                    !notification.read ? 'bg-blue-50' : ''
                  }`}
                  onClick={() => handleNotificationClick(notification as NotificationTagFix)}
                >
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0">
                      <Avatar className="h-10 w-10">
                        <AvatarImage 
                          src={notification.fromUser?.photoURL || '/default-avatar.png'} 
                          alt={notification.fromUser?.displayName || 'User'}
                        />
                        <AvatarFallback className="bg-blue-600 text-white font-medium">
                          {notification.fromUser?.displayName?.[0]?.toUpperCase() || 'U'}
                        </AvatarFallback>
                      </Avatar>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900">
                        <span className="font-medium text-blue-600">
                          {notification.fromUser?.displayName || 'Someone'}
                        </span>
                        {' '}
                        <span className="text-gray-700">
                          {notification.data?.message || notification.data?.text || getNotificationText(notification as NotificationTagFix)}
                        </span>
                      </p>
                      {notification.data?.postContent && (
                        <p className="mt-1 text-sm text-gray-500 truncate">
                          "{notification.data.postContent}..."
                        </p>
                      )}
                      <div className="flex items-center justify-between mt-1">
                        <p className="text-xs text-blue-600">
                          {formatDistanceToNow(notification.createdAt.toDate(), { addSuffix: true })}
                        </p>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => handleDeleteNotification(notification.id, e)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Delete Single Notification Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Notification</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this notification? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteNotification} className="bg-red-500 hover:bg-red-600">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete All Notifications Dialog */}
      <AlertDialog open={deleteAllDialogOpen} onOpenChange={setDeleteAllDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete All Notifications</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete all notifications? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteAllNotifications} className="bg-red-500 hover:bg-red-600">
              Delete All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
} 
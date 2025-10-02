'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useNotifications } from '@/lib/notifications';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Bell, Heart, Users, Image, MessageSquare, FileText, Clock, BellRing, Trash2 } from 'lucide-react';
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

export default function NotificationsPage() {
  const { user } = useAuth();
  const { notifications, loading, deleteNotification, deleteAllNotifications } = useNotifications();
  const [filter, setFilter] = useState('all');
  const [displayedNotifications, setDisplayedNotifications] = useState(20);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [notificationToDelete, setNotificationToDelete] = useState<string | null>(null);
  const [deleteAllDialogOpen, setDeleteAllDialogOpen] = useState(false);

  const filteredNotifications = filter === 'all' 
    ? notifications.slice(0, displayedNotifications)
    : notifications.filter(n => !n.read).slice(0, displayedNotifications);

  const hasMore = notifications.length > displayedNotifications;

  const getNotificationText = (notification: any) => {
    switch (notification.type) {
      case 'memory':
        return 'shared a memory with you';
      case 'friend_request':
        return 'sent you a friend request';
      case 'story':
        return 'added to their story';
      case 'photo':
        return 'shared new photos';
      case 'listing':
        return 'posted a new listing';
      case 'thread':
        return 'mentioned you in a thread';
      case 'like':
        return 'liked your post';
      default:
        return 'sent you a notification';
    }
  };

  const getNotificationIcon = (type: string) => {
    const iconClass = "w-6 h-6 text-[#E91E63]"; // Slightly larger icons for the page view
    switch (type) {
      case 'memory':
        return <Clock className={iconClass} />;
      case 'friend_request':
        return <Users className={iconClass} />;
      case 'story':
        return <Image className={iconClass} />;
      case 'photo':
        return <Image className={iconClass} />;
      case 'listing':
        return <FileText className={iconClass} />;
      case 'thread':
        return <MessageSquare className={iconClass} />;
      case 'like':
        return <Heart className={iconClass} />;
      default:
        return <BellRing className={iconClass} />;
    }
  };

  const handleNotificationClick = (notification: any) => {
    if (notification.type === 'follow') {
      window.location.href = `/profile/${notification.data?.userId}`;
    }
    // Remove post-related navigation
  };

  const loadMore = () => {
    setIsLoadingMore(true);
    setTimeout(() => {
      setDisplayedNotifications(prev => prev + 20);
      setIsLoadingMore(false);
    }, 500);
  };

  const handleDeleteNotification = (notificationId: string) => {
    setNotificationToDelete(notificationId);
    setDeleteDialogOpen(true);
  };

  const handleDeleteAllNotifications = () => {
    setDeleteAllDialogOpen(true);
  };

  const confirmDeleteNotification = async () => {
    if (notificationToDelete) {
      await deleteNotification(notificationToDelete);
      setDeleteDialogOpen(false);
      setNotificationToDelete(null);
    }
  };

  const confirmDeleteAllNotifications = async () => {
    await deleteAllNotifications();
    setDeleteAllDialogOpen(false);
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">Please sign in to view notifications</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
        {notifications.length > 0 && (
          <Button
            variant="ghost"
            size="icon"
            className="text-gray-500 hover:text-red-500"
            onClick={handleDeleteAllNotifications}
          >
            <Trash2 className="h-5 w-5" />
          </Button>
        )}
      </div>

      <div className="mb-6">
        <Tabs value={filter} onValueChange={setFilter} className="w-full">
          <TabsList className="grid w-48 grid-cols-2">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="unread">Unread</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      
      {loading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-start space-x-4 p-4 bg-gray-50 rounded-lg animate-pulse">
              <div className="h-10 w-10 rounded-full bg-gray-200" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-200 rounded w-3/4" />
                <div className="h-3 bg-gray-200 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredNotifications.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500">No notifications</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredNotifications.map((notification) => (
            <div 
              key={notification.id} 
              className="flex items-start space-x-4 p-4 hover:bg-gray-50 cursor-pointer transition-colors duration-200 group"
              onClick={() => handleNotificationClick(notification)}
            >
              <Avatar className="h-10 w-10">
                <AvatarImage src={notification.fromUser?.photoURL} />
                <AvatarFallback>
                  {notification.fromUser?.displayName?.[0]}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-900">
                  <span className="font-medium">{notification.fromUser?.displayName}</span>{' '}
                  {notification.data?.message || notification.data?.text || getNotificationText(notification)}
                </p>
                <p className="text-xs text-gray-500">
                  {formatDistanceToNow(notification.createdAt.toDate(), { addSuffix: true })}
                </p>
              </div>
              <div className="flex items-center space-x-2">
                {getNotificationIcon(notification.type)}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteNotification(notification.id);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}

          {hasMore && (
            <div className="text-center pt-4">
              <Button
                variant="outline"
                onClick={loadMore}
                disabled={isLoadingMore}
                className="text-gray-600 hover:text-gray-900"
              >
                {isLoadingMore ? 'Loading...' : 'See previous notifications'}
              </Button>
            </div>
          )}
        </div>
      )}

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
    </div>
  );
} 
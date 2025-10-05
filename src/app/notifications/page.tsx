'use client';

import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useNotificationsInfiniteScroll } from '@/lib/notifications';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';
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
  const { notifications, loading, hasMore, loadMore } = useNotificationsInfiniteScroll(user?.uid || '', 20);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [notificationToDelete, setNotificationToDelete] = useState<string | null>(null);
  const [deleteAllDialogOpen, setDeleteAllDialogOpen] = useState(false);

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
      window.location.href = `/profile/${notification.data?.userId || notification.fromUserId}`;
    } else if (notification.type === 'comment') {
      // Navigate to the specific post with comment highlighted
      const postId = notification.data?.postId;
      const commentId = notification.data?.commentId;
      if (postId) {
        let url = `/post/${postId}`;
        if (commentId) {
          url += `?showComments=true&commentId=${commentId}&highlight=true`;
        } else {
          url += '?showComments=true';
        }
        window.location.href = url;
      } else {
        // Fallback to user profile if no postId
        window.location.href = `/profile/${notification.fromUserId}`;
      }
    } else if (notification.type === 'like') {
      // Navigate to the specific post
      const postId = notification.data?.postId;
      if (postId) {
        window.location.href = `/post/${postId}`;
      } else {
        // Fallback to user profile if no postId
        window.location.href = `/profile/${notification.fromUserId}`;
      }
    } else if (notification.type === 'mention') {
      // Navigate to the specific post with comment highlighted
      const postId = notification.data?.postId;
      const commentId = notification.data?.commentId;
      if (postId) {
        let url = `/post/${postId}`;
        if (commentId) {
          url += `?showComments=true&commentId=${commentId}&highlight=true`;
        } else {
          url += '?showComments=true';
        }
        window.location.href = url;
      } else {
        // Fallback to user profile if no postId
        window.location.href = `/profile/${notification.fromUserId}`;
      }
    }
  };


  const deleteNotification = async (notificationId: string) => {
    try {
      const { deleteDoc, doc } = await import('firebase/firestore');
      const { db } = await import('@/lib/firebase');
      await deleteDoc(doc(db, 'notifications', notificationId));
      console.log('🔔 Notification deleted:', notificationId);
    } catch (error) {
      console.error('Error deleting notification:', error);
      throw error;
    }
  };

  const deleteAllNotifications = async () => {
    try {
      const { collection, query, where, getDocs, writeBatch } = await import('firebase/firestore');
      const { db } = await import('@/lib/firebase');
      
      if (!user?.uid) return;
      
      // Get all notifications for the user
      const q = query(
        collection(db, 'notifications'),
        where('toUserId', '==', user.uid)
      );
      
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        console.log('🔔 No notifications to delete');
        return;
      }
      
      // Use batch delete for better performance
      const batch = writeBatch(db);
      
      snapshot.forEach((docSnapshot) => {
        batch.delete(docSnapshot.ref);
      });
      
      await batch.commit();
      console.log('🔔 Deleted', snapshot.size, 'notifications for user:', user.uid);
    } catch (error) {
      console.error('Error deleting all notifications:', error);
      throw error;
    }
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
    <div className="w-full max-w-4xl mx-auto">
      <div className="px-3 py-2 border-b border-gray-100 flex justify-between items-center bg-white">
        <h1 className="text-sm font-medium text-gray-700">
          Notifications
        </h1>
        {notifications.length > 0 && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-gray-500 hover:text-red-500 hover:bg-red-50 rounded-full transition-all duration-200"
            onClick={handleDeleteAllNotifications}
            style={{
              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.1)',
              background: 'rgba(255, 255, 255, 0.8)',
              backdropFilter: 'blur(10px)'
            }}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        )}
      </div>

      {loading ? (
        <div className="p-4 text-center text-xs text-gray-500 bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg mx-3 my-1">
          <div className="animate-spin w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-1"></div>
          Loading...
        </div>
      ) : notifications.length === 0 ? (
        <div className="p-4 text-center text-xs text-gray-500 bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg mx-3 my-1">
          <Bell className="w-5 h-5 text-gray-400 mx-auto mb-1" />
          No notifications
        </div>
      ) : (
        <div 
          className="max-h-[600px] overflow-y-auto p-1 pb-4 invisible-scrollbar" 
          style={{
            scrollBehavior: 'smooth',
            overscrollBehavior: 'contain'
          }}
        >
          {notifications.map((notification) => (
            <div
              key={notification.id}
              className="notification-card"
              role="alert"
              onClick={() => handleNotificationClick(notification)}
              style={{
                width: '100%',
                maxWidth: '100%',
                padding: '0.5rem 0.75rem',
                color: '#111827',
                backgroundColor: 'white',
                borderRadius: '0.5rem',
                boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
                marginBottom: '0.5rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              <div className="notification-header" style={{ marginBottom: '0.0625rem', display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="notification-close-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteNotification(notification.id);
                  }}
                  aria-label="Close"
                  style={{
                    backgroundColor: 'white',
                    justifyContent: 'center',
                    alignItems: 'center',
                    flexShrink: 0,
                    color: '#9ca3af',
                    borderRadius: '0.25rem',
                    padding: '0.125rem',
                    height: '1.25rem',
                    width: '1.25rem',
                    display: 'inline-flex',
                    transition: 'all 0.2s ease',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
              <div className="notification-content" style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', paddingTop: '0.25rem' }}>
                <div className="notification-avatar-container" style={{ position: 'relative', display: 'inline-block', flexShrink: 0 }}>
                  <div className="notification-avatar" style={{ width: '2.5rem', height: '2.5rem', borderRadius: '50%', backgroundColor: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: '0.875rem' }}>
                    {notification.fromUser?.photoURL ? (
                      <img 
                        src={notification.fromUser.photoURL} 
                        alt={notification.fromUser?.displayName || 'User'} 
                        style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
                      />
                    ) : (
                      notification.fromUser?.displayName?.[0] || 'U'
                    )}
                  </div>
                  <div className="notification-status-badge" style={{ position: 'absolute', bottom: 0, right: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '1rem', height: '1rem', backgroundColor: '#2563eb', borderRadius: '50%' }}>
                    {getNotificationIcon(notification.type)}
                  </div>
                </div>
                <div className="notification-text" style={{ flex: 1, minWidth: 0 }}>
                  <div className="notification-user-name" style={{ fontSize: '0.875rem', fontWeight: 600, color: '#111827', marginBottom: '0.125rem' }}>
                    {notification.fromUser?.displayName || 'Unknown User'}
                  </div>
                  <div className="notification-message" style={{ fontSize: '0.875rem', fontWeight: 400, color: '#374151', marginBottom: '0.125rem' }}>
                    {notification.data?.message || notification.data?.text || getNotificationText(notification)}
                  </div>
                  <div className="notification-time" style={{ fontSize: '0.75rem', fontWeight: 500, color: '#2563eb' }}>
                    {formatDistanceToNow(notification.createdAt, { addSuffix: true })}
                  </div>
                </div>
              </div>
            </div>
          ))}

          {hasMore && (
            <div className="text-center pt-4 px-3">
              <Button
                variant="outline"
                onClick={loadMore}
                disabled={loading}
                className="text-xs text-gray-600 hover:text-gray-900 bg-white border-gray-200 hover:bg-gray-50"
                style={{
                  fontSize: '0.75rem',
                  padding: '0.25rem 0.75rem',
                  height: 'auto',
                  borderRadius: '0.375rem'
                }}
              >
                {loading ? 'Loading...' : 'Load more notifications'}
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
"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { Bell, Heart, Users, Image, MessageSquare, FileText, Clock, BellRing, Trash2, Terminal, MessageCircle, UserPlus, AtSign, XCircle, AlertTriangle } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/hooks/useAuth';
import { useNotificationsDropdown, Notification, markAllNotificationsAsRead } from '@/lib/notifications';
import { deleteNotification, restoreNotification } from '@/lib/firebase/db';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
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
import { useToast } from '@/hooks/use-toast';
import { useSimpleToast } from '@/components/ui/SimpleToast';
import { doc, getDoc } from 'firebase/firestore';
// import { toast } from 'react-hot-toast'; // TODO: Add toast functionality
import { db } from '@/lib/firebase';

// The Notification type is now imported from @/lib/notifications

export function NotificationsDropdown() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { toast: simpleToast } = useSimpleToast();
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState('all');
  const [undoMessage, setUndoMessage] = useState<{id: string, data: any} | null>(null);
  const router = useRouter();
  
  // Use infinite scroll notifications
  const { notifications, loading } = useNotificationsDropdown(user?.uid || null, 10);
  const displayNotifications = notifications;
  const unreadCount = displayNotifications.filter(n => !n.read).length;

  // Focus scroll container when dropdown opens
  useEffect(() => {
    if (isOpen && scrollContainerRef.current) {
      // Small delay to ensure dropdown is fully rendered
      setTimeout(() => {
        scrollContainerRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Mark all notifications as read when opening the dropdown
  useEffect(() => {
    if (isOpen && unreadCount > 0 && user?.uid) {
      console.log('🔔 Marking all notifications as read for user:', user.uid);
      markAllNotificationsAsRead(user.uid);
    }
  }, [isOpen, unreadCount, user?.uid]);

  // Split notifications into New and Earlier
  const now = new Date();
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  
  const filteredNotifications = filter === 'all' 
    ? displayNotifications.slice(0, 10) // Only show first 10 notifications
    : displayNotifications.filter(n => !n.read).slice(0, 10); // Only show first 10 unread notifications

  const getNotificationIcon = (notification: Notification) => {
    switch (notification.type) {
      case 'like':
        return (
          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
          </svg>
        );
      case 'comment':
        return (
          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 18">
            <path d="M18 4H16V9C16 10.0609 15.5786 11.0783 14.8284 11.8284C14.0783 12.5786 13.0609 13 12 13H9L6.846 14.615C7.17993 14.8628 7.58418 14.9977 8 15H11.667L15.4 17.8C15.5731 17.9298 15.7836 18 16 18C16.2652 18 16.5196 17.8946 16.7071 17.7071C16.8946 17.5196 17 17.2652 17 17V15H18C18.5304 15 19.0391 14.7893 19.4142 14.4142C19.7893 14.0391 20 13.5304 20 13V6C20 5.46957 19.7893 4.96086 19.4142 4.58579C19.0391 4.21071 18.5304 4 18 4Z" />
            <path d="M12 0H2C1.46957 0 0.960859 0.210714 0.585786 0.585786C0.210714 0.960859 0 1.46957 0 2V9C0 9.53043 0.210714 10.0391 0.585786 10.4142C0.960859 10.7893 1.46957 11 2 11H3V13C3 13.1857 3.05171 13.3678 3.14935 13.5257C3.24698 13.6837 3.38668 13.8114 3.55279 13.8944C3.71889 13.9775 3.90484 14.0126 4.08981 13.996C4.27477 13.9793 4.45143 13.9114 4.6 13.8L8.333 11H12C12.5304 11 13.0391 10.7893 13.4142 10.4142C13.7893 10.0391 14 9.53043 14 9V2C14 1.46957 13.7893 0.960859 13.4142 0.585786C13.0391 0.210714 12.5304 0 12 0Z" />
          </svg>
        );
      case 'follow':
        return (
          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
            <path d="M8 9a3 3 0 100-6 3 3 0 000 6zM8 11a6 6 0 016 6H2a6 6 0 016-6zM16 7a1 1 0 10-2 0v1h-1a1 1 0 100 2h1v1a1 1 0 102 0v-1h1a1 1 0 100-2h-1V7z" />
          </svg>
        );
      case 'tag':
      case 'mention':
        return (
          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
        );
        case 'subscription_expiring':
          return <AlertTriangle className="w-3 h-3 text-white" />;
        case 'subscription_expired':
          return <XCircle className="w-3 h-3 text-white" />;
      default:
        return (
          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
          </svg>
        );
    }
  };

  const getNotificationText = (notification: Notification) => {
    switch (notification.type) {
      case 'like':
        return 'liked your post';
      case 'comment':
        return 'commented on your post';
      case 'follow':
        return 'started following you';
        case 'subscription_expiring':
          return notification.message || 'Your subscription expires in 24 hours';
        case 'subscription_expired':
          return notification.message || 'Your subscription has expired';
      default:
        return 'sent you a notification';
    }
  };


  const handleNotificationClick = async (notification: Notification) => {
    let url = '';
    if (notification.type === 'follow') {
      url = `/profile/${notification.fromUserId}`;
      router.push(url);
    } else if (notification.type === 'comment') {
      // Navigate to the specific post with comment highlighted
      const postId = notification.data?.postId;
      const commentId = notification.data?.commentId;
      if (postId) {
        url = `/post/${postId}`;
        if (commentId) {
          url += `?showComments=true&commentId=${commentId}&highlight=true`;
        } else {
          url += '?showComments=true';
        }
        router.push(url);
      } else {
        // Fallback to user profile if no postId
        url = `/profile/${notification.fromUserId}`;
        router.push(url);
      }
    } else if (notification.type === 'like') {
      // Navigate to the specific post
      const postId = notification.data?.postId;
      if (postId) {
        url = `/post/${postId}`;
        router.push(url);
      } else {
        // Fallback to user profile if no postId
        url = `/profile/${notification.fromUserId}`;
        router.push(url);
      }
    } else if (notification.type === 'mention') {
      // Navigate to the specific post with comment highlighted
      const postId = notification.data?.postId;
      const commentId = notification.data?.commentId;
      if (postId) {
        url = `/post/${postId}`;
        if (commentId) {
          url += `?showComments=true&commentId=${commentId}&highlight=true`;
        } else {
          url += '?showComments=true';
        }
        router.push(url);
      } else {
        // Fallback to user profile if no postId
        url = `/profile/${notification.fromUserId}`;
        router.push(url);
      }
        } else if (notification.type === 'subscription_expiring' || notification.type === 'subscription_expired') {
          // Navigate to creator's profile to resubscribe
          const creatorId = notification.data?.creatorId;
          if (creatorId) {
            url = `/profile/${creatorId}`;
            router.push(url);
          } else {
            // Fallback to subscriptions page
            url = '/subscriptions';
            router.push(url);
          }
        }
    setIsOpen(false); // Close the dropdown after navigation
  };

  const handleDeleteNotification = async (notificationId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    
    try {
      console.log('🔔 Deleting notification:', notificationId);
      
      // Find the notification to delete and store its data for potential undo
      const notificationToDelete = notifications.find(n => n.id === notificationId);
      if (!notificationToDelete) {
        console.error('🔔 Notification not found:', notificationId);
        return;
      }
      
      // Store notification data for undo
      const notificationData = {
        type: notificationToDelete.type,
        fromUserId: notificationToDelete.fromUserId,
        toUserId: notificationToDelete.toUserId,
        fromUser: notificationToDelete.fromUser,
        read: notificationToDelete.read,
        data: notificationToDelete.data,
        createdAt: notificationToDelete.createdAt // Preserve original timestamp
      };
      
      // Delete the notification
      await deleteNotification(notificationId);
      console.log('🔔 Notification deleted successfully');
      
      // Update local state immediately
      // Notification will be removed by the real-time listener
      
      // Show undo message within the dropdown
      console.log('🔔 Showing undo message in dropdown');
      setUndoMessage({ id: notificationId, data: notificationData });
      
      // Auto-hide undo message after 5 seconds
      setTimeout(() => {
        setUndoMessage(null);
      }, 5000);
    } catch (error) {
      console.error('🔔 Error deleting notification:', error);
    }
  };


  const handleDeleteAllNotifications = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    
    try {
      console.log('🔔 Deleting all notifications for user:', user?.uid);
      // Import necessary functions from firebase/firestore
      const { collection, query, where, getDocs, writeBatch } = await import('firebase/firestore');
      const { db } = await import('@/lib/firebase');
      
      if (!user?.uid) return;
      
      // Get all notifications for the user
      const q = query(collection(db, 'notifications'), where('toUserId', '==', user.uid));
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        console.log('🔔 No notifications to delete');
        return;
      }
      
      // Use batch delete for better performance
      const batch = writeBatch(db);
      snapshot.forEach((doc) => {
        batch.delete(doc.ref);
      });
      
      await batch.commit();
      console.log('🔔 Deleted', snapshot.size, 'notifications');
      
      // Update local state immediately
      // Notifications will be cleared by the real-time listener
      
      // Show toast notification
      simpleToast({
        title: "All notifications deleted",
        description: "All notifications have been removed",
        duration: 5000
      });
    } catch (error) {
      console.error('🔔 Error deleting all notifications:', error);
    }
  };



  return (
    <>
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <button 
            className="relative p-2 text-gray-600 hover:text-blue-600 focus:outline-none transition-all duration-300 w-10 h-10 flex items-center justify-center rounded-full hover:bg-blue-50 group"
            style={{
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
              background: 'rgba(255, 255, 255, 0.9)',
              backdropFilter: 'blur(10px)'
            }}
          >
            <Bell className="w-5 h-5 transition-transform duration-200 group-hover:scale-110" />
            {unreadCount > 0 && (
              <span 
                className="absolute -top-1 -right-1 inline-flex items-center justify-center min-w-[20px] h-5 px-2 text-xs font-bold leading-none text-white transform bg-gradient-to-r from-red-500 to-pink-500 rounded-full animate-pulse shadow-lg"
                style={{
                  boxShadow: '0 2px 8px rgba(239, 68, 68, 0.4)'
                }}
              >
                {unreadCount}
              </span>
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent 
          align="end" 
          className="w-80 max-h-[600px] bg-white border-0 shadow-2xl animate-in fade-in-0 zoom-in-95 duration-200 rounded-2xl overflow-hidden"
          style={{
            boxShadow: `
              0 20px 25px -5px rgba(0, 0, 0, 0.1),
              0 10px 10px -5px rgba(0, 0, 0, 0.04),
              0 0 0 1px rgba(255, 255, 255, 0.05),
              inset 0 1px 0 rgba(255, 255, 255, 0.1)
            `,
            background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.2)'
          }}
          onWheel={(e) => e.stopPropagation()}
        >
          <div className="px-3 py-2 border-b border-gray-100 flex justify-between items-center bg-white">
            <h3 className="text-xs font-medium text-gray-700">
              Notifications
            </h3>
            <div className="flex items-center space-x-2">
              {displayNotifications.length > 0 && (
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
              <Link 
                href="/notifications" 
                className="text-xs text-gray-600 hover:text-gray-800 font-medium transition-all duration-200"
              >
                See all
              </Link>
            </div>
          </div>
          <div className="px-3 py-1.5 border-b border-gray-100">
            <div className="radio-inputs">
              <label className="radio">
                <input 
                  type="radio" 
                  name="notification-filter" 
                  checked={filter === 'all'}
                  onChange={() => setFilter('all')}
                />
                <span className="name">All</span>
              </label>
              <label className="radio">
                <input 
                  type="radio" 
                  name="notification-filter" 
                  checked={filter === 'unread'}
                  onChange={() => setFilter('unread')}
                />
                <span className="name">Unread</span>
              </label>
            </div>
          </div>
          
          {/* Undo Message */}
          {undoMessage && (
            <div className="px-3 py-2 bg-blue-50 border-b border-blue-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                  <span className="text-xs text-blue-700 font-medium">Notification deleted</span>
                </div>
                <button
                  onClick={async () => {
                    try {
                      console.log('🔔 Undoing delete notification');
                      const restoredId = await restoreNotification(undoMessage.data);
                      
                      console.log('🔔 Notification restored successfully with ID:', restoredId);
                      setUndoMessage(null); // Hide the undo message
                      
                      // The real-time listener will automatically pick up the restored notification
                    } catch (error) {
                      console.error('🔔 Error restoring notification:', error);
                    }
                  }}
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium underline"
                >
                  Undo
                </button>
              </div>
            </div>
          )}
          
          {loading ? (
            <div className="p-4 text-center text-xs text-gray-500 bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg mx-3 my-1">
              <div className="animate-spin w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-1"></div>
              Loading...
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="p-4 text-center text-xs text-gray-500 bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg mx-3 my-1">
              <Bell className="w-5 h-5 text-gray-400 mx-auto mb-1" />
              No notifications
            </div>
          ) : (
            <div 
              ref={scrollContainerRef}
              className="max-h-[550px] overflow-y-auto p-1 pb-6 invisible-scrollbar" 
              onWheel={(e) => {
                e.stopPropagation();
                // Allow the scroll to work normally within this container
              }}
              style={{
                scrollBehavior: 'smooth',
                overscrollBehavior: 'contain'
              }}
              tabIndex={0}
            >
              {filteredNotifications.map((notification) => (
                <div
                  key={notification.id}
                  className="notification-card"
                  role="alert"
                  onClick={() => handleNotificationClick(notification)}
                  style={{
                    width: '100%',
                    maxWidth: '100%',
                    padding: '0.1875rem 0.125rem 0.1875rem 0.1875rem',
                    color: '#111827',
                    backgroundColor: 'white',
                    borderRadius: '0.375rem',
                    boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
                    marginBottom: '0.25rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <div className="notification-header" style={{ marginBottom: '0.0625rem', display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      className="notification-close-btn"
                      onClick={(e) => handleDeleteNotification(notification.id, e)}
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
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <span className="sr-only">Close</span>
                      <svg
                        className="w-2 h-2"
                        aria-hidden="true"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 14 14"
                        style={{ width: '0.5rem', height: '0.5rem' }}
                      >
                        <path
                          stroke="currentColor"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="m1 1 6 6m0 0 6 6M7 7l6-6M7 7l-6 6"
                        ></path>
                      </svg>
                    </button>
                  </div>
                  <div className="notification-content" style={{ display: 'flex', alignItems: 'flex-start', gap: '0.25rem', paddingTop: '0.125rem' }}>
                    <div className="notification-avatar-container" style={{ position: 'relative', display: 'inline-block', flexShrink: 0 }}>
                      {notification.fromUser?.photoURL ? (
                        <img
                          src={notification.fromUser.photoURL}
                          alt={notification.fromUser.displayName || 'User'}
                          className="notification-avatar"
                          style={{
                            width: '1.75rem',
                            height: '1.75rem',
                            borderRadius: '50%',
                            objectFit: 'cover'
                          }}
                        />
                      ) : (
                        <div 
                          className="notification-avatar"
                          style={{
                            width: '1.75rem',
                            height: '1.75rem',
                            borderRadius: '50%',
                            backgroundColor: '#16a34a',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white',
                            fontWeight: 'bold',
                            fontSize: '0.625rem'
                          }}
                        >
                          {notification.fromUser?.displayName?.[0]?.toUpperCase() || 'U'}
                        </div>
                      )}
                      <span 
                        className="notification-status-badge"
                        style={{
                          position: 'absolute',
                          bottom: 0,
                          right: 0,
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: '0.875rem',
                          height: '0.875rem',
                          backgroundColor: '#2563eb',
                          borderRadius: '50%'
                        }}
                      >
                        {getNotificationIcon(notification)}
                        <span className="sr-only">Message icon</span>
                      </span>
                    </div>
                    <div className="notification-text" style={{ flex: 1, minWidth: 0 }}>
                      <div className="notification-user-name" style={{ fontSize: '0.75rem', fontWeight: 600, color: '#111827', marginBottom: '0.03125rem' }}>
                        {notification.fromUser?.displayName || notification.fromUser?.username || 'Someone'}
                      </div>
                      <div className="notification-message" style={{ fontSize: '0.75rem', fontWeight: 400, color: '#374151', marginBottom: '0.03125rem' }}>
                        {getNotificationText(notification)}
                      </div>
                      <span className="notification-time" style={{ fontSize: '0.625rem', fontWeight: 500, color: '#2563eb' }}>
                        {formatDistanceToNow(notification.createdAt, { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
              
              {/* Loading indicator */}
              {loading && (
                <div className="flex justify-center py-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                </div>
              )}
            </div>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

    </>
  );
} 
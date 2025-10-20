"use client";

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation'
import NewLogo from './common/NewLogo'
import { cn } from '@/lib/utils'
import { Skeleton } from './ui/skeleton'
import { auth } from '@/lib/firebase'
import { db } from '@/lib/firebase'
import { doc, getDoc } from 'firebase/firestore'
import { signOut } from 'firebase/auth'
import Link from 'next/link'
import { useTotalUnreadMessagesCount } from '@/lib/messages'
import { useAuth } from '@/hooks/useAuth';
import { useRoutePrefetch } from './common/RoutePrefetcher'
import { ContentUploadDialog } from '@/components/creator/ContentUploadDialog';

interface NavItem {
  label: string
  path: string
  ariaLabel?: string
  showForRoles?: string[]
}

interface LeftSidebarProps {
  isLoading?: boolean
}

const navItems: NavItem[] = [
  {
    label: 'Home',
    path: '/home',
    ariaLabel: 'Go to home page'
  },
  {
    label: 'Messages',
    path: '/messages',
    ariaLabel: 'View your messages'
  },
  {
    label: 'Subscriptions',
    path: '/subscriptions',
    ariaLabel: 'View your subscribed creators'
  },
  {
    label: 'Profile',
    path: '/profile',
    ariaLabel: 'View your profile'
  },
  {
    label: 'Creator Dashboard',
    path: '/creator/dashboard',
    ariaLabel: 'Manage your creator content and subscribers',
    showForRoles: ['creator', 'admin', 'superadmin', 'owner']
  },
  {
    label: 'Settings',
    path: '/settings',
    ariaLabel: 'Manage your settings'
  }
];

export function LeftSidebar({ isLoading = false }: LeftSidebarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [username, setUsername] = useState<string | null>(null)
  const [userRole, setUserRole] = useState<string | null>(null)
  const unreadCount = useTotalUnreadMessagesCount()
  const { logout } = useAuth();
  const { prefetchOnHover } = useRoutePrefetch();

  useEffect(() => {
    async function fetchUserData() {
      const user = auth.currentUser;
      if (!user) return;
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        const userData = userDoc.data();
        if (userData?.username) {
          setUsername(userData.username);
        }
        if (userData?.role) {
          setUserRole(userData.role);
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
      }
    }
    fetchUserData();
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
      router.push('/');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent, path: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      router.push(path)
    }
  }

  const filteredNavItems = navItems.filter(item => {
    if (!item.showForRoles) return true;
    return item.showForRoles.includes(userRole || '');
  });

  return (
    <aside className="w-64 h-screen sticky top-0 bg-white px-0 -pt-8 pb-8 flex flex-col relative z-20" role="navigation" aria-label="Main navigation" style={{ pointerEvents: 'auto' }}>
      {/* Logo */}
      <div className="mb-0 -ml-4 -mt-24 p-0 m-0">
        <NewLogo size="xxxl" showText={false} />
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 px-4 -mt-20">
        <ul className="space-y-1" role="menu">
          {isLoading ? (
            // Loading skeletons
            Array(4).fill(0).map((_, index) => (
              <li key={index} className="py-2">
                <Skeleton className="h-6 w-24" />
              </li>
            ))
          ) : (
            <>
              {filteredNavItems.map((item) => (
                <li key={item.path} role="menuitem">
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      console.log('🔍 Clicking navigation item:', item.label, item.path);
                      router.push(item.path);
                    }}
                    onMouseEnter={() => prefetchOnHover(item.path)}
                    onKeyDown={(e) => handleKeyPress(e, item.path)}
                    className={cn(
                      "w-full text-left px-4 py-3 rounded-lg transition-all duration-200 text-sm",
                      "focus:outline-none",
                      "relative z-10 cursor-pointer",
                      pathname === item.path
                        ? "text-blue-600 bg-blue-50 font-medium"
                        : "text-gray-700 hover:text-gray-900 hover:bg-gray-50 font-normal"
                    )}
                    aria-label={item.ariaLabel}
                    aria-current={pathname === item.path ? 'page' : undefined}
                    style={{ pointerEvents: 'auto' }}
                  >
                    <div className="flex items-center justify-between">
                      <span>{item.label}</span>
                      {item.label === 'Messages' && unreadCount > 0 && (
                        <div className="w-3 h-3 rounded-full shadow-lg" style={{
                          background: 'linear-gradient(135deg, #60a5fa 0%, #3b82f6 50%, #2563eb 100%)',
                          boxShadow: '0 2px 8px rgba(96, 165, 250, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.3)',
                          border: '1px solid rgba(255, 255, 255, 0.2)'
                        }} />
                      )}
                    </div>
                  </button>
                </li>
              ))}
              {(userRole === 'admin' || userRole === 'superadmin' || userRole === 'owner') && (
                <li key="/admin" role="menuitem">
                  <button
                    onClick={() => router.push('/admin')}
                    onKeyDown={(e) => handleKeyPress(e, '/admin')}
                    className={cn(
                      "w-full text-left px-4 py-3 rounded-lg transition-all duration-200 text-sm",
                      "focus:outline-none",
                      pathname === '/admin'
                        ? "text-blue-600 bg-blue-50 font-medium"
                        : "text-gray-700 hover:text-gray-900 hover:bg-gray-50 font-normal"
                    )}
                    aria-label="Go to admin dashboard"
                    aria-current={pathname === '/admin' ? 'page' : undefined}
                  >
                    Admin Dashboard
                  </button>
                </li>
              )}
              
              {/* Upload Button - Available for all logged-in users */}
              <li key="upload" role="menuitem">
                <ContentUploadDialog 
                  onUploadComplete={() => {
                    // Refresh the page or trigger a re-render
                    window.location.reload();
                  }}
                />
              </li>
            </>
          )}
        </ul>
      </nav>

      {/* Logout Button */}
      <div className="pt-6 border-t border-gray-200">
        <button
          onClick={handleLogout}
          className="w-full text-left px-4 py-3 text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-lg transition-all duration-200 font-normal text-sm"
          aria-label="Sign out"
        >
          Sign Out
        </button>
      </div>
    </aside>
  )
} 
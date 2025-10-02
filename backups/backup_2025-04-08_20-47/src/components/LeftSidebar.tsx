"use client";

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation'
import { FiHome, FiMessageCircle, FiSettings, FiUser, FiLogOut } from 'react-icons/fi'
import { Logo } from './common/Logo'
import { cn } from '@/lib/utils'
import { Skeleton } from './ui/skeleton'
import { NotificationsDropdown } from './NotificationsDropdown'
import { auth } from '@/lib/firebase'
import { db } from '@/lib/firebase'
import { doc, getDoc } from 'firebase/firestore'
import { signOut } from 'firebase/auth'

interface NavItem {
  icon: JSX.Element
  label: string
  path: string
  ariaLabel?: string
}

interface LeftSidebarProps {
  isLoading?: boolean
}

export function LeftSidebar({ isLoading = false }: LeftSidebarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [username, setUsername] = useState<string | null>(null)

  useEffect(() => {
    async function fetchUsername() {
      const user = auth.currentUser
      if (!user) return

      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid))
        const userData = userDoc.data()
        if (userData?.username) {
          setUsername(userData.username)
        }
      } catch (error) {
        console.error('Error fetching username:', error)
      }
    }

    fetchUsername()
  }, [])

  const navItems: NavItem[] = [
    { 
      icon: <FiHome className="w-6 h-6" />, 
      label: 'Home', 
      path: '/home',
      ariaLabel: 'Go to home feed'
    },
    { 
      icon: <FiMessageCircle className="w-6 h-6" />, 
      label: 'Messages', 
      path: '/messages',
      ariaLabel: 'Open messages'
    },
    { 
      icon: <FiUser className="w-6 h-6" />, 
      label: 'Profile', 
      path: username ? `/${username}` : '/profile',
      ariaLabel: 'View your profile'
    },
    { 
      icon: <FiSettings className="w-6 h-6" />, 
      label: 'Settings', 
      path: '/settings',
      ariaLabel: 'Open settings'
    },
  ]

  const handleLogout = async () => {
    try {
      await signOut(auth)
      router.push('/')
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent, path: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      router.push(path)
    }
  }

  return (
    <aside className="w-64 h-screen sticky top-0 border-r border-[#EEEEEE] bg-white px-4 py-6 flex flex-col" role="navigation" aria-label="Main navigation">
      {/* Logo and Notifications */}
      <div className="px-4 mb-8 flex items-center justify-between">
        <Logo size="md" />
        <NotificationsDropdown />
      </div>

      {/* Navigation Items */}
      <nav className="flex-1">
        <ul className="space-y-2" role="menu">
          {isLoading ? (
            // Loading skeletons
            Array(4).fill(0).map((_, index) => (
              <li key={index} className="px-4 py-3">
                <Skeleton className="flex items-center space-x-4">
                  <div className="w-6 h-6 rounded-full" />
                  <div className="h-4 w-20" />
                </Skeleton>
              </li>
            ))
          ) : (
            navItems.map((item) => (
              <li key={item.path} role="menuitem">
                <button
                  onClick={() => router.push(item.path)}
                  onKeyDown={(e) => handleKeyPress(e, item.path)}
                  className={cn(
                    "w-full flex items-center space-x-4 px-4 py-3 rounded-xl transition-colors",
                    "focus:outline-none focus:ring-2 focus:ring-pink-200",
                    pathname === item.path
                      ? "text-[#E91E63] bg-pink-50"
                      : "text-[#666666] hover:text-[#E91E63] hover:bg-pink-50"
                  )}
                  aria-label={item.ariaLabel}
                  aria-current={pathname === item.path ? 'page' : undefined}
                >
                  {item.icon}
                  <span className="font-medium">{item.label}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      </nav>

      {/* Logout Button */}
      <button
        onClick={handleLogout}
        className="mt-auto w-full flex items-center space-x-4 px-4 py-3 rounded-xl text-[#666666] hover:text-[#E91E63] hover:bg-pink-50 transition-colors"
        aria-label="Log out"
      >
        <FiLogOut className="w-6 h-6" />
        <span className="font-medium">Logout</span>
      </button>
    </aside>
  );
} 
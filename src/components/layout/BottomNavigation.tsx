'use client';

import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Home, User, MessageCircle, Menu, Plus } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useTotalUnreadMessagesCount } from '@/lib/messages';

interface BottomNavigationProps {
  onMenuClick: () => void;
  isMenuOpen: boolean;
  onUploadClick: () => void;
}

export function BottomNavigation({ onMenuClick, isMenuOpen, onUploadClick }: BottomNavigationProps) {
  const pathname = usePathname();
  const { user } = useAuth();
  const unreadCount = useTotalUnreadMessagesCount();

  if (!user) return null;

  const navItems = [
    {
      href: '#',
      label: 'Menu',
      icon: Menu,
      onClick: onMenuClick,
    },
    {
      href: '/home',
      label: 'Home',
      icon: Home,
    },
    {
      href: '#',
      label: 'Upload',
      icon: Plus,
      onClick: onUploadClick,
    },
    {
      href: '/messages',
      label: 'Messages',
      icon: MessageCircle,
    },
    {
      href: '/profile',
      label: 'Profile',
      icon: User,
    },
  ];

  const isActive = (href: string) => {
    if (href === '/home') return pathname === '/home';
    return pathname?.startsWith(href);
  };

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm border-t border-gray-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] safe-bottom">
      <div className="flex h-14 pb-safe">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          
          if (item.href === '#' && item.onClick) {
            return (
              <button
                key={item.label}
                onClick={item.onClick}
                className="flex-1 flex items-center justify-center relative min-w-0 active:scale-95 transition-transform"
              >
                <div className={`p-2 rounded-xl transition-colors ${
                  active ? 'bg-blue-100' : ''
                }`}>
                  <Icon 
                    className={`w-6 h-6 transition-colors ${
                      active ? 'text-blue-600' : 'text-gray-600'
                    }`}
                    strokeWidth={active ? 2.5 : 2}
                  />
                </div>
              </button>
            );
          }
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex-1 flex items-center justify-center relative min-w-0 active:scale-95 transition-transform"
            >
              <div className={`p-2 rounded-xl transition-colors relative ${
                active ? 'bg-blue-100' : ''
              }`}>
                <Icon 
                  className={`w-6 h-6 transition-colors ${
                    active ? 'text-blue-600' : 'text-gray-600'
                  }`}
                  strokeWidth={active ? 2.5 : 2}
                />
                {/* Unread message dot - only show on Messages icon */}
                {item.label === 'Messages' && unreadCount > 0 && (
                  <div 
                    className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full shadow-lg flex-shrink-0" 
                    style={{
                      background: 'linear-gradient(135deg, #60a5fa 0%, #3b82f6 50%, #2563eb 100%)',
                      boxShadow: '0 2px 8px rgba(96, 165, 250, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.3)',
                    }}
                  />
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}


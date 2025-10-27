'use client';

import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Home, User, MessageCircle, Menu, Plus } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

interface BottomNavigationProps {
  onMenuClick: () => void;
  isMenuOpen: boolean;
  onUploadClick: () => void;
}

export function BottomNavigation({ onMenuClick, isMenuOpen, onUploadClick }: BottomNavigationProps) {
  const pathname = usePathname();
  const { user } = useAuth();

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
      href: user?.username ? `/${user.username}` : '/profile',
      label: 'Profile',
      icon: User,
    },
  ];

  const isActive = (href: string) => {
    if (href === '/home') return pathname === '/home';
    return pathname?.startsWith(href);
  };

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
      <div className="flex h-16">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          
          if (item.href === '#' && item.onClick) {
            return (
              <button
                key={item.label}
                onClick={item.onClick}
                className="flex-1 flex flex-col items-center justify-center relative min-w-0"
              >
                <div className="flex flex-col items-center gap-1">
                  <div className={`p-2 rounded-lg transition-colors ${
                    active ? 'bg-blue-50' : ''
                  }`}>
                    <Icon 
                      className={`w-5 h-5 transition-colors ${
                        active ? 'text-blue-600' : 'text-gray-500'
                      }`}
                      strokeWidth={active ? 2.5 : 2}
                    />
                  </div>
                  <span className={`text-[10px] font-medium transition-colors ${
                    active ? 'text-blue-600' : 'text-gray-500'
                  }`}>
                    {item.label}
                  </span>
                </div>
              </button>
            );
          }
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex-1 flex flex-col items-center justify-center relative min-w-0"
            >
              <div className="flex flex-col items-center gap-1">
                <div className={`p-2 rounded-lg transition-colors ${
                  active ? 'bg-blue-50' : ''
                }`}>
                  <Icon 
                    className={`w-5 h-5 transition-colors ${
                      active ? 'text-blue-600' : 'text-gray-500'
                    }`}
                    strokeWidth={active ? 2.5 : 2}
                  />
                </div>
                <span className={`text-[10px] font-medium transition-colors ${
                  active ? 'text-blue-600' : 'text-gray-500'
                }`}>
                  {item.label}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}


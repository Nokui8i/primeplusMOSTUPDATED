'use client';

import { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import MainLayout from './MainLayout';

// Pages that should not use the main layout
const pagesWithoutLayout = [
  '/', // Landing page
  '/login',
  '/register',
  '/reset-password',
  '/verify-email',
  '/complete-profile',
  // Add streamer page pattern
  '/streamer',
  // Add profile page pattern
  '/profile',
];

interface RootLayoutContentProps {
  children: ReactNode;
}

export function RootLayoutContent({ children }: RootLayoutContentProps) {
  const pathname = usePathname() || '';
  // Check for streamer dynamic route
  const shouldUseMainLayout = !pagesWithoutLayout.includes(pathname);

  return (
    <main className={`h-screen overflow-hidden ${shouldUseMainLayout ? 'bg-white' : 'bg-white'}`}>
      {shouldUseMainLayout ? <MainLayout>{children}</MainLayout> : children}
    </main>
  );
} 
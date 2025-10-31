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
  
  // Check if we're in a mobile chat thread - don't wrap in main layout structure
  const isMobileChatThread = pathname?.startsWith('/messages/') ?? false;

  // For mobile chat threads, render directly without main wrapper
  if (isMobileChatThread) {
    return <>{children}</>;
  }

  return (
    <main 
      className={`overflow-hidden ${shouldUseMainLayout ? 'bg-white' : 'bg-white'}`}
      style={{
        height: 'var(--vvh, 100vh)',
        minHeight: 'var(--vvh, 100vh)',
        maxHeight: 'var(--vvh, 100vh)'
      }}
    >
      {shouldUseMainLayout ? <MainLayout>{children}</MainLayout> : children}
    </main>
  );
} 
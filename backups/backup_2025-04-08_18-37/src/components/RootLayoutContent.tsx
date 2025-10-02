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
  '/complete-profile'
];

interface RootLayoutContentProps {
  children: ReactNode;
}

export function RootLayoutContent({ children }: RootLayoutContentProps) {
  const pathname = usePathname();
  const shouldUseMainLayout = !pagesWithoutLayout.includes(pathname);

  return (
    <main className={`min-h-screen ${shouldUseMainLayout ? 'bg-[#F5F5F5]' : 'bg-gray-50'}`}>
      {shouldUseMainLayout ? <MainLayout>{children}</MainLayout> : children}
    </main>
  );
} 
'use client';

import { AuthProvider } from '@/lib/auth';
import { NotificationProvider } from '@/contexts/NotificationContext';
import { NotificationList } from '@/components/common/NotificationList';

interface ProvidersProps {
  children: React.ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <AuthProvider>
      <NotificationProvider>
        {children}
        <NotificationList />
      </NotificationProvider>
    </AuthProvider>
  );
} 
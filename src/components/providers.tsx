'use client';

import { AuthProvider } from '@/lib/auth';
import { NotificationProvider } from '@/contexts/NotificationContext';
import { FilterProvider } from '@/contexts/FilterContext';
import { NotificationList } from '@/components/common/NotificationList';

interface ProvidersProps {
  children: React.ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <AuthProvider>
      <NotificationProvider>
        <FilterProvider>
          {children}
          <NotificationList />
        </FilterProvider>
      </NotificationProvider>
    </AuthProvider>
  );
} 
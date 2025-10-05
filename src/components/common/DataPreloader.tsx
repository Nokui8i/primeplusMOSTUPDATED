'use client';

import { useEffect } from 'react';
import { collection, query, limit, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { useAuth } from '@/hooks/useAuth';

export function DataPreloader() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    // Preload common data in the background
    const preloadData = async () => {
      try {
        // Preload user's notifications (first 10)
        const notificationsQuery = query(
          collection(db, 'notifications'),
          limit(10)
        );
        await getDocs(notificationsQuery);

        // Preload suggested creators
        const creatorsQuery = query(
          collection(db, 'users'),
          limit(5)
        );
        await getDocs(creatorsQuery);

        // Preload recent posts (first 5)
        const postsQuery = query(
          collection(db, 'posts'),
          limit(5)
        );
        await getDocs(postsQuery);

        console.log('🚀 Data preloaded successfully');
      } catch (error) {
        console.warn('Failed to preload some data:', error);
      }
    };

    // Delay preloading to not interfere with initial page load
    const timeoutId = setTimeout(preloadData, 2000);
    
    return () => clearTimeout(timeoutId);
  }, [user]);

  return null; // This component doesn't render anything
}

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Define all the main routes that should be prefetched
const MAIN_ROUTES = [
  '/home',
  '/messages', 
  '/subscriptions',
  '/profile',
  '/creator/dashboard',
  '/settings',
  '/notifications'
];

// Define routes that should be prefetched on hover
const HOVER_ROUTES = [
  '/profile',
  '/creator/dashboard',
  '/settings'
];

export function RoutePrefetcher() {
  const router = useRouter();

  useEffect(() => {
    // Prefetch main routes immediately after component mount
    const prefetchMainRoutes = async () => {
      // Add a small delay to not block initial page load
      setTimeout(() => {
        MAIN_ROUTES.forEach(route => {
          try {
            router.prefetch(route);
            console.log(`🚀 Prefetched route: ${route}`);
          } catch (error) {
            console.warn(`Failed to prefetch ${route}:`, error);
          }
        });
      }, 1000); // Wait 1 second after page load
    };

    prefetchMainRoutes();
  }, [router]);

  return null; // This component doesn't render anything
}

// Hook for prefetching routes on hover
export function useRoutePrefetch() {
  const router = useRouter();

  const prefetchOnHover = (route: string) => {
    try {
      router.prefetch(route);
      console.log(`🚀 Prefetched on hover: ${route}`);
    } catch (error) {
      console.warn(`Failed to prefetch ${route} on hover:`, error);
    }
  };

  return { prefetchOnHover };
}

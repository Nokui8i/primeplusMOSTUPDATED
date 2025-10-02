'use client';

import { ReactNode, useState, useEffect, useRef } from 'react';
import { LeftSidebar } from './LeftSidebar';
import { RightSidebar } from './RightSidebar';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { useRouter } from 'next/navigation';
import AppLoader from './common/AppLoader';
import { AnimatePresence } from 'framer-motion';
import { FiMenu, FiFilter, FiX } from 'react-icons/fi';
import { motion } from 'framer-motion';
import { UserProfile } from '@/lib/types/user';

interface Creator {
  id: string;
  displayName: string;
  nickname: string;
  photoURL: string;
  isVerified?: boolean;
}

interface TrendingTopic {
  id: string;
  name: string;
  postCount: number;
}

interface MainLayoutProps {
  children: ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  const [suggestedCreators, setSuggestedCreators] = useState<UserProfile[]>([]);
  const [trendingTopics, setTrendingTopics] = useState<TrendingTopic[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showLoader, setShowLoader] = useState(true);
  const [showMobileLeft, setShowMobileLeft] = useState(false);
  const [showMobileRight, setShowMobileRight] = useState(false);
  const router = useRouter();
  const mainContentRef = useRef<HTMLElement>(null);

  useEffect(() => {
    let timeout: NodeJS.Timeout;
    async function fetchData() {
      try {
        // Fetch suggested creators
        const creatorsRef = collection(db, 'users');
        const creatorsQuery = query(
          creatorsRef,
          where('role', '==', 'creator'),
          orderBy('stats.followers', 'desc'),
          limit(5)
        );
        const creatorsSnapshot = await getDocs(creatorsQuery);
        const creators = creatorsSnapshot.docs.map(doc => ({
          id: doc.id,
          displayName: doc.data().displayName || '',
          nickname: doc.data().nickname || '',
          photoURL: doc.data().photoURL || '',
          isVerified: doc.data().isVerified || false
        }));

        // Fetch trending topics
        const topicsRef = collection(db, 'topics');
        const topicsQuery = query(
          topicsRef,
          orderBy('postCount', 'desc'),
          limit(5)
        );
        const topicsSnapshot = await getDocs(topicsQuery);
        const topics = topicsSnapshot.docs.map(doc => ({
          id: doc.id,
          name: doc.data().name || '',
          postCount: doc.data().postCount || 0
        }));

        setSuggestedCreators(creators.map(creator => ({
          uid: creator.id,
          id: creator.id,
          email: '',
          username: creator.nickname || '',
          displayName: creator.displayName || '',
          photoURL: creator.photoURL || '',
          isAgeVerified: false,
          isVerified: creator.isVerified || false,
          role: 'creator' as const,
          status: 'active' as const,
          bio: '',
          location: '',
          website: '',
          defaultSubscriptionPlanId: null,
          defaultSubscriptionType: null,
          socialLinks: {},
          stats: {
            followers: 0,
            following: 0,
            posts: 0,
            engagement: 0
          },
          createdAt: new Date() as any,
          updatedAt: new Date() as any
        })));
        setTrendingTopics(topics);
      } catch (error) {
        console.error('Error fetching sidebar data:', error);
      } finally {
        setIsLoading(false);
        // Ensure loader is visible for at least 600ms
        timeout = setTimeout(() => setShowLoader(false), 600);
      }
    }

    fetchData();
    return () => clearTimeout(timeout);
  }, []);

  // Global scroll handler - redirect all scroll events to main content
  useEffect(() => {
    const handleGlobalScroll = (e: WheelEvent) => {
      // Only handle scroll if we're not already scrolling the main content
      if (mainContentRef.current && !mainContentRef.current.contains(e.target as Node)) {
        e.preventDefault();
        const scrollAmount = e.deltaY;
        mainContentRef.current.scrollTop += scrollAmount;
      }
    };

    // Add event listener to document
    document.addEventListener('wheel', handleGlobalScroll, { passive: false });

    return () => {
      document.removeEventListener('wheel', handleGlobalScroll);
    };
  }, []);

  return (
    <div className="min-h-screen bg-white">
      {/* Content Layer */}
      <div className="flex justify-center">
        <div className="flex w-full max-w-7xl">
          {/* Left Sidebar */}
          <aside className="hidden md:block w-64 h-screen sticky top-0 bg-white border-r border-gray-200">
            <LeftSidebar />
          </aside>

          {/* Main Content - Responsive */}
          <main ref={mainContentRef} className="flex-1 flex flex-col h-screen overflow-y-auto w-full invisible-scrollbar border-l border-gray-200">
            <div className="w-full py-8">
              {children}
            </div>
          </main>

          {/* Right Sidebar */}
          <aside className="hidden md:block w-80 h-screen sticky top-0 bg-white border-l border-gray-200">
            <div className="h-full overflow-y-auto invisible-scrollbar">
              <RightSidebar
                suggestedCreators={suggestedCreators}
                trendingTopics={trendingTopics}
                isLoading={isLoading}
              />
            </div>
          </aside>
        </div>
      </div>

      {/* Mobile Sidebar Buttons */}
      <button
        className="fixed top-2 left-2 z-40 md:hidden bg-white/70 rounded-lg p-1.5 border border-gray-200/60 backdrop-blur-sm"
        onClick={() => setShowMobileLeft(true)}
        aria-label="Open navigation menu"
      >
        <FiMenu className="w-6 h-6 text-gray-700" />
      </button>
      <button
        className="fixed top-2 right-2 z-40 md:hidden bg-white/80 rounded-full p-1.5 shadow-lg backdrop-blur-lg"
        onClick={() => setShowMobileRight(true)}
        aria-label="Open suggestions menu"
      >
        <FiFilter className="w-5 h-5 text-gray-700" />
      </button>

      {/* Mobile Left Sidebar Drawer */}
      <AnimatePresence>
        {showMobileLeft && (
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed inset-0 z-50 flex md:hidden"
          >
            <div className="w-[85vw] max-w-[320px] h-full bg-white/95 backdrop-blur-lg shadow-xl relative flex flex-col">
              <div className="flex items-center justify-between p-4 border-b border-gray-100">
                <h2 className="text-lg font-semibold text-gray-900">Menu</h2>
                <button
                  onClick={() => setShowMobileLeft(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  aria-label="Close menu"
                >
                  <FiX className="w-5 h-5 text-gray-600" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                <LeftSidebar />
              </div>
            </div>
            <div
              className="flex-1 h-full bg-black/30 backdrop-blur-sm"
              onClick={() => setShowMobileLeft(false)}
              aria-label="Close navigation menu"
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile Right Sidebar Drawer */}
      <AnimatePresence>
        {showMobileRight && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed inset-0 z-50 flex justify-end md:hidden"
          >
            <div className="w-[85vw] max-w-[320px] h-full bg-white/95 backdrop-blur-lg shadow-xl relative">
              <RightSidebar
                suggestedCreators={suggestedCreators}
                trendingTopics={trendingTopics}
                isLoading={isLoading}
              />
            </div>
            <div
              className="flex-1 h-full bg-black/30 backdrop-blur-sm"
              onClick={() => setShowMobileRight(false)}
              aria-label="Close suggestions menu"
            />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>{showLoader && <AppLoader isVisible={showLoader} />}</AnimatePresence>
    </div>
  );
} 
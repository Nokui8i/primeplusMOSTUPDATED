'use client';

import { ReactNode, useState, useEffect, useRef } from 'react';
import { LeftSidebar } from './LeftSidebar';
import { RightSidebar } from './RightSidebar';
import { NotificationsDropdown } from './NotificationsDropdown';
import { Search } from './Search';
import { BottomNavigation } from './layout/BottomNavigation';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { isUserBlocked } from '@/lib/services/block.service';
import { useRouter, usePathname } from 'next/navigation';
import AppLoader from './common/AppLoader';
import { AnimatePresence } from 'framer-motion';
import { FiMenu, FiX, FiBell } from 'react-icons/fi';
import { motion } from 'framer-motion';
import { SearchDropdown } from './SearchDropdown';
import { FilterDropdown } from './layout/FilterDropdown';
import { UserProfile } from '@/lib/types/user';
import { RoutePrefetcher } from './common/RoutePrefetcher';
import { DataPreloader } from './common/DataPreloader';
import { ChatWindows } from './chat/ChatWindows';
import { useAuth } from '@/hooks/useAuth';
import { ContentUploadDialog } from './creator/ContentUploadDialog';
import { useMessages } from '@/contexts/MessagesContext';
import { Search as SearchIcon, ChevronDown } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

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
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const mainContentRef = useRef<HTMLElement>(null);
  const { user } = useAuth();
  const messages = useMessages();
  
  // Hide right sidebar on messages page
  const isMessagesPage = pathname === '/messages';
  const isSubscriptionsPage = pathname === '/subscriptions';
  
  // Check if we're in a chat conversation on mobile
  const isInMobileChat = (isMessagesPage && messages.selectedChat) || (pathname?.startsWith('/messages/') ?? false);


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

        // Filter out creators who blocked current user (one-way blocking)
        const filteredCreators = [];
        for (const creator of creators) {
          if (user?.uid) {
            // Only check if creator blocked current user (one-way blocking)
            const creatorBlockedUser = await isUserBlocked(creator.id, user.uid);

            if (!creatorBlockedUser) {
              filteredCreators.push(creator);
            }
          } else {
            // If no user is logged in, include all creators
            filteredCreators.push(creator);
          }
        }

        setSuggestedCreators(filteredCreators.map(creator => ({
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
  }, [user?.uid]);


  // Global scroll handler - redirect scroll events to main content when mouse is over feed
  useEffect(() => {
    let scrollAccumulator = 0;
    let animationFrame: number;
    let accumulatorTimeout: NodeJS.Timeout;

    const handleGlobalScroll = (e: WheelEvent) => {

            // Only redirect scroll to main content when mouse is over the feed area
            if (mainContentRef.current) {
              // Check if we're already scrolling within the main content area
              const isWithinMainContent = mainContentRef.current.contains(e.target as Node);
              
              // Check if mouse is over the main content area
              const mainContentRect = mainContentRef.current.getBoundingClientRect();
              const isMouseOverFeed = (
                e.clientX >= mainContentRect.left &&
                e.clientX <= mainContentRect.right &&
                e.clientY >= mainContentRect.top &&
                e.clientY <= mainContentRect.bottom
              );
              
              
              // Only redirect scroll if mouse is over the feed area and we're not already scrolling within it
              if (!isWithinMainContent && isMouseOverFeed) {
          // Prevent default scroll behavior
          e.preventDefault();
          e.stopPropagation();
          
          // Accumulate scroll delta for smoother scrolling
          scrollAccumulator += e.deltaY;
          
          // Clear existing timeout and set new one to reset accumulator after inactivity
          if (accumulatorTimeout) {
            clearTimeout(accumulatorTimeout);
          }
          accumulatorTimeout = setTimeout(() => {
            scrollAccumulator = 0;
          }, 150); // Reset after 150ms of inactivity
          
          // Use requestAnimationFrame for smooth scrolling
          if (animationFrame) {
            cancelAnimationFrame(animationFrame);
          }
          
          animationFrame = requestAnimationFrame(() => {
            if (mainContentRef.current) {
              // Apply accumulated scroll with smooth multiplier
              const scrollAmount = scrollAccumulator * 1.5;
              mainContentRef.current.scrollTop += scrollAmount;
              scrollAccumulator *= 0.4; // Persistence factor
              
              // Continue animation if there's still accumulated scroll
              if (Math.abs(scrollAccumulator) > 1.0) {
                animationFrame = requestAnimationFrame(() => {
                  if (mainContentRef.current) {
                    mainContentRef.current.scrollTop += scrollAccumulator;
                    scrollAccumulator = 0;
                  }
                });
              } else {
                scrollAccumulator = 0;
              }
            }
          });
              }
            }
    };

    // Add event listener with passive: false to allow preventDefault
    document.addEventListener('wheel', handleGlobalScroll, { passive: false });

    return () => {
      document.removeEventListener('wheel', handleGlobalScroll);
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
      if (accumulatorTimeout) {
        clearTimeout(accumulatorTimeout);
      }
    };
  }, []);

  return (
    <div 
      className="bg-white overflow-hidden"
      style={{
        height: 'var(--vvh, 100vh)',
        minHeight: 'var(--vvh, 100vh)',
        maxHeight: 'var(--vvh, 100vh)'
      }}
    >
      {/* Content Layer */}
      <div className="flex justify-center h-full">
        <div className="flex w-full max-w-7xl h-full">
          {/* Left Sidebar - Responsive Widths */}
          <aside 
            className="hidden md:block w-64 sticky top-0 bg-white"
            style={{ height: 'var(--vvh, 100vh)' }}
          >
            <LeftSidebar />
          </aside>

          {/* Center Area with Header and Main Content */}
          <div className={`flex-1 flex flex-col ${!isMessagesPage ? 'border-l border-gray-200' : ''} bg-white overflow-hidden h-full`}>
            {/* Mobile Header - Page Name with Search Icon */}
            {!isInMobileChat && (
            <div className="md:hidden fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 bg-white border-b border-gray-200 flex-shrink-0" style={{ paddingTop: 'max(6px, env(safe-area-inset-top, 6px))', paddingBottom: '6px' }}>
              <h1 className="text-base font-bold text-gray-900">
                {pathname === '/home' && 'Home'}
                {pathname === '/messages' && 'Messages'}
                {pathname === '/subscriptions' && 'Subscriptions'}
                {pathname === '/profile' && 'Profile'}
                {pathname === '/settings' && 'Settings'}
                {pathname === '/notifications' && 'Notifications'}
                {pathname === '/search' && 'Search'}
                {pathname === '/creator/dashboard' && 'Creator Dashboard'}
                {pathname === '/admin' && 'Admin Dashboard'}
                {pathname === '/complete-profile' && 'Complete Profile'}
                {pathname?.startsWith('/post/') && 'Post'}
                {pathname?.startsWith('/') && pathname.split('/').filter(Boolean).length > 1 && !['home', 'messages', 'subscriptions', 'profile', 'settings', 'notifications', 'search', 'creator', 'admin', 'complete-profile'].includes(pathname.split('/')[1]) && pathname.split('/')[1].charAt(0).toUpperCase() + pathname.split('/')[1].slice(1)}
              </h1>
              <div className="flex items-center gap-2 ml-auto">
                {!isMessagesPage ? (
                  <>
                    <div className="relative">
                      <SearchDropdown />
                    </div>
                    <NotificationsDropdown />
                    <div className="ml-auto -mr-2">
                      <FilterDropdown />
                    </div>
                  </>
                ) : (
                  <>
                    {/* Messages Search */}
                    <div className="relative">
                      <style jsx>{`
                        .search-container-messages {
                          position: relative;
                          --size-button: 36px;
                          color: white;
                        }
                        
                        .search-input-messages {
                          padding-right: var(--size-button);
                          padding-left: 10px;
                          height: var(--size-button);
                          font-size: 16px;
                          border: 2px solid transparent;
                          color: #000;
                          outline: none;
                          width: var(--size-button);
                          transition: width ease 0.3s;
                          background-color: transparent;
                          border-radius: 10px;
                          cursor: pointer;
                        }
                        
                        .search-input-messages:focus,
                        .search-input-messages:not(:invalid) {
                          width: 180px;
                          cursor: text;
                          border: 1px solid #d1d5db;
                          background-color: white;
                        }
                        
                        .search-icon-messages {
                          position: absolute;
                          width: var(--size-button);
                          height: var(--size-button);
                          top: 0;
                          right: 0;
                          padding: 6px;
                          pointer-events: none;
                          z-index: 10;
                        }
                        
                        .search-icon-messages svg {
                          width: 100%;
                          height: 100%;
                        }
                      `}</style>
                      <div className="search-container-messages">
                        <input
                          type="text"
                          name="search"
                          className="search-input-messages"
                          required
                          placeholder="Search..."
                          value={messages.searchQuery}
                          onChange={(e) => messages.setSearchQuery(e.target.value)}
                          autoComplete="off"
                        />
                        <div className="search-icon-messages">
                          <SearchIcon className="w-full h-full text-gray-500" />
                        </div>
                      </div>
                    </div>
                    
                    {/* Messages Filter */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="px-2 py-1 rounded-full flex items-center gap-1 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 shadow-sm transition-all duration-200 focus:outline-none focus:ring-0">
                          <span className="text-xs font-medium">
                            {messages.filterType === 'all' ? 'All' : messages.filterType === 'unread' ? 'Unread' : 'Pinned'}
                          </span>
                          <ChevronDown className="h-3 w-3" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent 
                        align="end" 
                        className="w-24 bg-white border-0 overflow-hidden p-0"
                        style={{
                          borderRadius: '12px',
                          boxShadow: '0 8px 16px rgba(0, 0, 0, 0.15), 0 2px 4px rgba(0, 0, 0, 0.1)',
                          background: 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)',
                        }}
                      >
                        <DropdownMenuItem 
                          onClick={() => messages.setFilterType('all')}
                          className={`cursor-pointer py-1.5 px-2.5 hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 transition-all duration-200 ${
                            messages.filterType === 'all' ? 'text-blue-600' : 'text-gray-700'
                          }`}
                          style={{ fontWeight: '500', fontSize: '12px' }}
                        >
                          All
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => messages.setFilterType('unread')}
                          className={`cursor-pointer py-1.5 px-2.5 hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 transition-all duration-200 ${
                            messages.filterType === 'unread' ? 'text-blue-600' : 'text-gray-700'
                          }`}
                          style={{ fontWeight: '500', fontSize: '12px' }}
                        >
                          Unread
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => messages.setFilterType('pinned')}
                          className={`cursor-pointer py-1.5 px-2.5 hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 transition-all duration-200 ${
                            messages.filterType === 'pinned' ? 'text-blue-600' : 'text-gray-700'
                          }`}
                          style={{ fontWeight: '500', fontSize: '12px' }}
                        >
                          Pinned
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </>
                )}
              </div>
            </div>
            )}

            {/* Desktop Header - Responsive */}
              {!isMessagesPage && (
              <div className="hidden md:block flex-shrink-0 z-10">
              <div className={`flex items-center gap-4 ${isMessagesPage ? 'px-4' : 'px-4 lg:px-6'} py-3 bg-white border-b border-gray-200`}>
                {/* Page Title */}
                <div className="flex-shrink-0">
                  <h1 className="text-xl font-bold text-gray-900">
                    {pathname === '/home' && 'Home'}
                    {pathname === '/subscriptions' && 'Subscriptions'}
                    {pathname === '/profile' && 'Profile'}
                    {pathname === '/settings' && 'Settings'}
                    {pathname === '/notifications' && 'Notifications'}
                    {pathname === '/search' && 'Search'}
                    {pathname === '/creator/dashboard' && 'Creator Dashboard'}
                    {pathname === '/admin' && 'Admin Dashboard'}
                    {pathname === '/complete-profile' && 'Complete Profile'}
                    {pathname?.startsWith('/post/') && 'Post'}
                    {pathname?.startsWith('/') && pathname.split('/').filter(Boolean).length > 1 && !['home', 'messages', 'subscriptions', 'profile', 'settings', 'notifications', 'search', 'creator', 'admin', 'complete-profile'].includes(pathname.split('/')[1]) && pathname.split('/')[1].charAt(0).toUpperCase() + pathname.split('/')[1].slice(1)}
                  </h1>
                </div>
                {/* Search Bar - Spacer */}
                <div className="flex-1 max-w-md"></div>
                {/* Search, Notifications & Filters */}
                <div className="flex items-center gap-0 flex-shrink-0 ml-auto -mr-2">
                  {!isMessagesPage ? (
                    <>
                      <div className="relative">
                        <SearchDropdown />
                      </div>
                  <NotificationsDropdown />
                      <FilterDropdown />
                    </>
                  ) : (
                    <>
                      {/* Messages Search */}
                      <div className="relative mr-2">
                        <style jsx>{`
                          .search-container-messages-desk {
                            position: relative !important;
                            --size-button: 36px;
                          }
                          
                          .search-input-messages-desk {
                            padding-right: var(--size-button);
                            padding-left: 10px;
                            height: var(--size-button);
                            font-size: 16px;
                            border: 2px solid transparent;
                            color: #000;
                            outline: none;
                            width: var(--size-button);
                            transition: width ease 0.3s;
                            background-color: transparent;
                            border-radius: 10px !important;
                            cursor: pointer !important;
                          }
                          
                          .search-input-messages-desk:focus,
                          .search-input-messages-desk:not(:invalid) {
                            width: 180px;
                            cursor: text;
                            border: 1px solid #d1d5db;
                            background-color: white;
                          }
                          
                          .search-icon-messages-desk {
                            position: absolute !important;
                            width: var(--size-button) !important;
                            height: var(--size-button) !important;
                            top: 0 !important;
                            right: 0 !important;
                            padding: 6px !important;
                            pointer-events: none !important;
                          }
                        `}</style>
                        <div className="search-container-messages-desk">
                          <input
                            type="text"
                            name="search"
                            className="search-input-messages-desk"
                            required
                            placeholder="Search..."
                            value={messages.searchQuery}
                            onChange={(e) => messages.setSearchQuery(e.target.value)}
                            autoComplete="off"
                          />
                          <div className="search-icon-messages-desk">
                            <SearchIcon className="w-full h-full text-gray-500" />
                          </div>
                        </div>
                      </div>
                      
                      {/* Messages Filter */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="px-2 py-1 rounded-full flex items-center gap-1 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 shadow-sm transition-all duration-200 focus:outline-none focus:ring-0">
                            <span className="text-xs font-medium">
                              {messages.filterType === 'all' ? 'All' : 'Unread'}
                            </span>
                            <ChevronDown className="h-3 w-3" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent 
                          align="end" 
                          className="w-24 bg-white border-0 overflow-hidden p-0"
                          style={{
                            borderRadius: '12px',
                            boxShadow: '0 8px 16px rgba(0, 0, 0, 0.15), 0 2px 4px rgba(0, 0, 0, 0.1)',
                            background: 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)',
                          }}
                        >
                          <DropdownMenuItem 
                            onClick={() => messages.setFilterType('all')}
                            className={`cursor-pointer py-1.5 px-2.5 hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 transition-all duration-200 ${
                              messages.filterType === 'all' ? 'text-blue-600' : 'text-gray-700'
                            }`}
                            style={{ fontWeight: '500', fontSize: '12px' }}
                          >
                            All
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => messages.setFilterType('unread')}
                            className={`cursor-pointer py-1.5 px-2.5 hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 transition-all duration-200 ${
                              messages.filterType === 'unread' ? 'text-blue-600' : 'text-gray-700'
                            }`}
                            style={{ fontWeight: '500', fontSize: '12px' }}
                          >
                            Unread
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </>
                  )}
                </div>
              </div>
              </div>
              )}

                {/* Main Content - Responsive */}
                <main 
                  ref={mainContentRef} 
                  className={`flex-1 w-full invisible-scrollbar relative pb-16 md:pb-0 pt-[48px] md:pt-0 ${isInMobileChat ? 'overflow-hidden' : (isSubscriptionsPage ? 'overflow-hidden subscriptions-page-main' : 'overflow-y-auto')}`}
                  style={{ 
                    scrollBehavior: 'smooth',
                    scrollbarWidth: 'none',
                    msOverflowStyle: 'none',
                    WebkitOverflowScrolling: 'touch',
                    minHeight: '0',
                    height: isSubscriptionsPage ? '100%' : 'auto'
                  }}
                >
                  <div className={`w-full ${isSubscriptionsPage ? 'h-full' : 'min-h-full'}`}>
                    {children}
                  </div>
                </main>
          </div>

          {/* Right Sidebar - Responsive Widths */}
          {!isMessagesPage && (
            <aside 
              className="hidden lg:block w-80 sticky top-0 bg-white border-l border-gray-200"
              style={{ height: 'var(--vvh, 100vh)' }}
            >
              <RightSidebar
                suggestedCreators={suggestedCreators}
                trendingTopics={trendingTopics}
                isLoading={isLoading}
              />
            </aside>
          )}
        </div>
      </div>

      {/* Mobile Sidebar Buttons */}
      {/* Menu button removed - now in bottom navigation */}
      {/* Suggested creators button removed - not needed on mobile */}

      {/* Mobile Left Sidebar Drawer - Responsive */}
      <AnimatePresence>
        {showMobileLeft && (
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed inset-0 z-50 flex md:hidden"
          >
            <div className="w-[85vw] max-w-[320px] h-full bg-white/95 backdrop-blur-lg shadow-xl relative flex flex-col pt-safe">
              <div className="flex items-center justify-between p-5 border-b border-gray-100">
                <h2 className="text-xl font-bold text-gray-900">Menu</h2>
                <button
                  onClick={() => setShowMobileLeft(false)}
                  className="p-3 hover:bg-gray-100 active:bg-gray-200 rounded-xl transition-all touch-manipulation"
                  aria-label="Close menu"
                >
                  <FiX className="w-6 h-6 text-gray-600" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto scrollbar-hide pb-safe">
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

      {/* Mobile Right Sidebar Drawer - Removed - not needed on mobile */}

      <AnimatePresence>{showLoader && <AppLoader isVisible={showLoader} />}</AnimatePresence>
      
      {/* Route Prefetcher for faster navigation */}
      <RoutePrefetcher />
      
      {/* Data Preloader for common data */}
      <DataPreloader />
      
      {/* Chat Windows for mini chat functionality */}
      <ChatWindows />
      
      {/* Bottom Navigation - Mobile Only */}
      {!isInMobileChat && (
      <BottomNavigation 
        onMenuClick={() => setShowMobileLeft(!showMobileLeft)} 
        isMenuOpen={showMobileLeft}
        onUploadClick={() => setShowUploadDialog(true)}
      />
      )}
      
      {/* Upload Dialog */}
      <ContentUploadDialog 
        open={showUploadDialog}
        onOpenChange={setShowUploadDialog}
        onUploadComplete={() => setShowUploadDialog(false)}
      >
        <></>
      </ContentUploadDialog>
    </div>
  );
} 
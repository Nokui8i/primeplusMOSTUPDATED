'use client';

import { ReactNode, useState, useEffect } from 'react';
import { LeftSidebar } from './LeftSidebar';
import { RightSidebar } from './RightSidebar';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';

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
  const [suggestedCreators, setSuggestedCreators] = useState<Creator[]>([]);
  const [trendingTopics, setTrendingTopics] = useState<TrendingTopic[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
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

        setSuggestedCreators(creators);
        setTrendingTopics(topics);
      } catch (error) {
        console.error('Error fetching sidebar data:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, []);

  return (
    <div className="flex min-h-screen">
      {/* Left Sidebar - Fixed */}
      <div className="w-64 fixed left-0 top-0 h-screen bg-white border-r border-[#EEEEEE]">
        <LeftSidebar />
      </div>

      {/* Main Content - Scrollable */}
      <div className="flex-1 ml-64 mr-80 min-h-screen">
        {children}
      </div>

      {/* Right Sidebar - Fixed */}
      <div className="w-80 fixed right-0 top-0 h-screen bg-white border-l border-[#EEEEEE]">
        <RightSidebar
          suggestedCreators={suggestedCreators}
          trendingTopics={trendingTopics}
          isLoading={isLoading}
        />
      </div>
    </div>
  );
} 
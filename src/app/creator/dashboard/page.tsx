'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FiUsers, FiBarChart2, FiImage, FiSettings } from 'react-icons/fi';
import OverviewTab from './components/OverviewTab';
import SubscribersTab from './components/SubscribersTab';
import SubscriptionsTab from './components/SubscriptionsTab';
import { db } from '@/lib/firebase/config';
import { collection, query, where, getCountFromServer, Timestamp, getDocs } from 'firebase/firestore';

export default function CreatorDashboard() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    totalSubscribers: 0,
    totalViews: 0,
    totalLikes: 0,
    totalComments: 0,
    recentSubscribers: 0,
    recentViews: 0,
  });

  useEffect(() => {
    async function fetchStats() {
      if (!user?.uid) {
        setIsLoading(false);
        return;
      }
      // Fetch total subscribers from 'subscriptions' collection
      const q = query(
        collection(db, 'subscriptions'),
        where('creatorId', '==', user.uid),
        where('status', '==', 'active')
      );
      const snapshot = await getCountFromServer(q);
      // Calculate start of the week (Monday)
      const now = new Date();
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is Sunday
      const weekStart = new Date(now.setDate(diff));
      weekStart.setHours(0, 0, 0, 0);
      // Query for new subscribers this week
      const weekQ = query(
        collection(db, 'subscriptions'),
        where('creatorId', '==', user.uid),
        where('status', '==', 'active'),
        where('createdAt', '>=', Timestamp.fromDate(weekStart))
      );
      const weekSnapshot = await getCountFromServer(weekQ);

      // Fetch all posts for this creator
      const postsQ = query(collection(db, 'posts'), where('authorId', '==', user.uid));
      const postsSnap = await getDocs(postsQ);
      let totalLikes = 0;
      let totalComments = 0;
      let totalViews = 0;
      let recentViews = 0;
      // Get all days in the current week
      const weekDays = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(weekStart);
        d.setDate(weekStart.getDate() + i);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        weekDays.push(`${yyyy}-${mm}-${dd}`);
      }
      for (const docSnap of postsSnap.docs) {
        const data = docSnap.data();
        totalLikes += typeof data.likes === 'number' ? data.likes : 0;
        // Count real comments in subcollection
        const commentsCol = collection(db, 'posts', docSnap.id, 'comments');
        const commentsSnap = await getCountFromServer(commentsCol);
        totalComments += commentsSnap.data().count || 0;
        // Sum views from engagement
        if (typeof data.engagement?.views === 'number') {
          totalViews += data.engagement.views;
        }
        // Sum views this week from engagement.viewsByDay
        if (data.engagement?.viewsByDay) {
          for (const day of weekDays) {
            if (typeof data.engagement.viewsByDay[day] === 'number') {
              recentViews += data.engagement.viewsByDay[day];
            }
          }
        }
      }
      totalComments = Math.max(0, totalComments);

      setStats(prev => ({
        ...prev,
        totalSubscribers: snapshot.data().count || 0,
        recentSubscribers: weekSnapshot.data().count || 0,
        totalLikes,
        totalComments,
        totalViews,
        recentViews,
      }));
      setIsLoading(false);
    }
    fetchStats();
  }, [user]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-black">Creator Dashboard</h1>
        <p className="text-gray-500 mt-1">Manage your content, subscribers, and settings</p>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 lg:w-[400px]">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <FiBarChart2 className="w-4 h-4" />
            <span className="hidden sm:inline">Overview</span>
          </TabsTrigger>
          <TabsTrigger value="subscriptions" className="flex items-center gap-2">
            <FiImage className="w-4 h-4" />
            <span className="hidden sm:inline">Subscriptions</span>
          </TabsTrigger>
          <TabsTrigger value="subscribers" className="flex items-center gap-2">
            <FiUsers className="w-4 h-4" />
            <span className="hidden sm:inline">Subscribers</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <OverviewTab stats={stats} />
        </TabsContent>

        <TabsContent value="subscriptions">
          <SubscriptionsTab />
        </TabsContent>

        <TabsContent value="subscribers">
          <SubscribersTab />
        </TabsContent>
      </Tabs>
    </div>
  );
} 
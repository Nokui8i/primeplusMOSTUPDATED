'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import OverviewTab from './components/OverviewTab';
import SubscribersTab from './components/SubscribersTab';
import SubscriptionsTab from './components/SubscriptionsTab';
import { db } from '@/lib/firebase/config';
import { collection, query, where, getCountFromServer, Timestamp, getDocs } from 'firebase/firestore';
import '@/styles/tab-navigation.css';

export default function CreatorDashboard() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
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
      console.log('[Dashboard] Found posts:', postsSnap.docs.length);
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
        console.log('[Dashboard] Post data:', {
          id: docSnap.id,
          likes: data.likes,
          engagement: data.engagement,
          hasViews: typeof data.engagement?.views,
          viewsValue: data.engagement?.views
        });
        
        // Count real likes in subcollection (not the counter field)
        const likesCol = collection(db, 'posts', docSnap.id, 'likes');
        const likesSnap = await getCountFromServer(likesCol);
        const likeCount = likesSnap.data().count || 0;
        console.log('[Dashboard] Post', docSnap.id, 'likes:', likeCount);
        totalLikes += likeCount;
        
        // Count real comments in subcollection
        const commentsCol = collection(db, 'posts', docSnap.id, 'comments');
        const commentsSnap = await getCountFromServer(commentsCol);
        const commentCount = commentsSnap.data().count || 0;
        console.log('[Dashboard] Post', docSnap.id, 'comments:', commentCount);
        totalComments += commentCount;
        
        // Sum views from engagement
        if (typeof data.engagement?.views === 'number') {
          console.log('[Dashboard] Adding views:', data.engagement.views);
          totalViews += data.engagement.views;
        } else {
          console.log('[Dashboard] No views found for post', docSnap.id);
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

      console.log('[Dashboard] Final stats:', {
        totalSubscribers: snapshot.data().count || 0,
        recentSubscribers: weekSnapshot.data().count || 0,
        totalLikes,
        totalComments,
        totalViews,
        recentViews,
      });
      
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

      {/* Radio Button Tabs */}
      <div className="flex justify-center mb-6">
        <div className="tab-container">
          <input 
            type="radio" 
            name="dashboard-tab" 
            id="tab1" 
            className="tab tab--1" 
            checked={activeTab === 'overview'}
            onChange={() => setActiveTab('overview')}
          />
          <label className="tab_label" htmlFor="tab1">Overview</label>

          <input 
            type="radio" 
            name="dashboard-tab" 
            id="tab2" 
            className="tab tab--2" 
            checked={activeTab === 'subscriptions'}
            onChange={() => setActiveTab('subscriptions')}
          />
          <label className="tab_label" htmlFor="tab2">Subscriptions</label>

          <input 
            type="radio" 
            name="dashboard-tab" 
            id="tab3" 
            className="tab tab--3" 
            checked={activeTab === 'subscribers'}
            onChange={() => setActiveTab('subscribers')}
          />
          <label className="tab_label" htmlFor="tab3">Subscribers</label>

          <div className="indicator"></div>
        </div>
      </div>

      {/* Tab Content */}
      <div className="mt-6">
        {activeTab === 'overview' && <OverviewTab stats={stats} />}
        {activeTab === 'subscriptions' && <SubscriptionsTab />}
        {activeTab === 'subscribers' && <SubscribersTab />}
      </div>
    </div>
  );
} 
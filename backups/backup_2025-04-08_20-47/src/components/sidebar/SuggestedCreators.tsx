import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, limit, getDocs, where, orderBy } from 'firebase/firestore';
import { CreatorCard } from '@/components/user/CreatorCard';
import { useAuth } from '@/lib/auth';

interface Creator {
  id: string;
  username: string;
  displayName: string;
  photoURL?: string;
  bio?: string;
  stats?: {
    followers: number;
    posts: number;
    engagement: number;
  };
}

export function SuggestedCreators() {
  const [creators, setCreators] = useState<Creator[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    const fetchSuggestedCreators = async () => {
      if (!user) return;

      try {
        // Query users who are creators and not the current user
        const q = query(
          collection(db, 'users'),
          where('role', '==', 'creator'),
          where('id', '!=', user.uid),
          orderBy('stats.followers', 'desc'),
          limit(5)
        );

        const querySnapshot = await getDocs(q);
        const suggestedCreators: Creator[] = [];

        querySnapshot.forEach((doc) => {
          const data = doc.data();
          suggestedCreators.push({
            id: doc.id,
            username: data.username,
            displayName: data.displayName,
            photoURL: data.photoURL,
            bio: data.bio,
            stats: data.stats
          });
        });

        setCreators(suggestedCreators);
      } catch (error) {
        console.error('Error fetching suggested creators:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSuggestedCreators();
  }, [user]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-[200px] animate-pulse rounded-lg bg-gray-100" />
        ))}
      </div>
    );
  }

  if (creators.length === 0) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Suggested Creators</h2>
        <p className="text-gray-500">No creators found yet. Be the first one!</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Suggested Creators</h2>
      {creators.map((creator) => (
        <CreatorCard
          key={creator.id}
          userId={creator.id}
          username={creator.username}
          displayName={creator.displayName}
          photoURL={creator.photoURL}
          bio={creator.bio}
          stats={creator.stats}
        />
      ))}
    </div>
  );
} 
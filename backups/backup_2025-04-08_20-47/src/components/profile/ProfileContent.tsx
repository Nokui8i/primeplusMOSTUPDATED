'use client';

import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { useFirestore } from '@/lib/firebase/hooks/useFirestore';
import { UserProfile } from '@/lib/types/user';
import { Post } from '@/lib/types/post';
import { PostCard } from '@/components/posts/PostCard';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';

interface ProfileContentProps {
  profile: UserProfile;
}

export function ProfileContent({ profile }: ProfileContentProps) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('posts');
  const db = useFirestore();

  useEffect(() => {
    if (!profile.id) return;

    // Query user's posts with real-time updates
    const postsQuery = query(
      collection(db, 'posts'),
      where('authorId', '==', profile.id),
      orderBy('createdAt', 'desc'),
      limit(12)
    );

    const unsubscribe = onSnapshot(
      postsQuery,
      (snapshot) => {
        const newPosts = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Post));
        setPosts(newPosts);
        setLoading(false);
      },
      (error) => {
        console.error('Error fetching posts:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [profile.id, db]);

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-48 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="posts" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger
            value="posts"
            onClick={() => setActiveTab('posts')}
            className="flex items-center space-x-2"
          >
            <span>Posts</span>
            <span className="text-sm text-gray-500">({posts.length})</span>
          </TabsTrigger>
          <TabsTrigger
            value="media"
            onClick={() => setActiveTab('media')}
            className="flex items-center space-x-2"
          >
            <span>Media</span>
            <span className="text-sm text-gray-500">
              ({posts.filter(post => post.mediaUrl).length})
            </span>
          </TabsTrigger>
          <TabsTrigger
            value="liked"
            onClick={() => setActiveTab('liked')}
            className="flex items-center space-x-2"
          >
            <span>Liked</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="posts" className="space-y-4 mt-6">
          {posts.length > 0 ? (
            posts.map(post => (
              <PostCard key={post.id} post={post} />
            ))
          ) : (
            <div className="text-center py-12">
              <h3 className="text-lg font-semibold text-gray-900">No posts yet</h3>
              <p className="text-gray-500 mt-2">When {profile.displayName || profile.username} posts, you'll see their posts here.</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="media" className="mt-6">
          <div className="grid grid-cols-3 gap-4">
            {posts
              .filter(post => post.mediaUrl)
              .map(post => (
                <PostCard key={post.id} post={post} variant="media" />
              ))}
          </div>
        </TabsContent>

        <TabsContent value="liked" className="space-y-4 mt-6">
          {/* TODO: Implement liked posts */}
          <div className="text-center py-12">
            <h3 className="text-lg font-semibold text-gray-900">Coming soon</h3>
            <p className="text-gray-500 mt-2">Liked posts will appear here.</p>
          </div>
        </TabsContent>
      </Tabs>

      {posts.length >= 12 && (
        <div className="text-center pt-4">
          <Button variant="outline">Load More</Button>
        </div>
      )}
    </div>
  );
} 
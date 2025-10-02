'use client';

import { useEffect, useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { doc, getDoc, collection, setDoc, Timestamp, query, getDocs, orderBy, limit, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Skeleton } from '@/components/ui/skeleton';
import { ContentUploadDialog } from '@/components/creator/ContentUploadDialog';
import { PostType, PostWithAuthor } from '@/lib/types/post';
import { User } from '@/lib/types/user';

export default function ProfileRedirect() {
  const router = useRouter();
  const { user } = useAuth();
  const [posts, setPosts] = useState<PostWithAuthor[]>([]);

  const getDateSafe = (value: any) => {
    if (!value) return new Date();
    if (typeof value.toDate === 'function') return value.toDate();
    if (value instanceof Date) return value;
    if (typeof value === 'string' || typeof value === 'number') return new Date(value);
    return new Date();
  };

  const processPost = async (doc: any): Promise<PostWithAuthor> => {
    const postData = doc.data();
    const authorSnap = await getDoc(doc(db, 'users', postData.authorId));
    const authorData = authorSnap.data() as User;

    if (!authorData) {
      throw new Error(`Author data not found for post ${doc.id}`);
    }

    const author = {
      id: authorSnap.id,
      uid: authorSnap.id,
      displayName: String(authorData.displayName || 'Anonymous'),
      email: String(authorData.email || ''),
      photoURL: String(authorData.photoURL || '/default-avatar.png'),
      createdAt: getDateSafe(authorData.createdAt),
      updatedAt: getDateSafe(authorData.updatedAt),
      role: authorData.role || 'user',
      bio: String(authorData.bio || ''),
      website: String(authorData.website || ''),
      location: String(authorData.location || ''),
      followers: Array.isArray(authorData.followers) ? authorData.followers : [],
      following: Array.isArray(authorData.following) ? authorData.following : [],
      username: String(authorData.username || ''),
      isVerified: Boolean(authorData.isVerified)
    };

    return {
      id: doc.id,
      title: postData.title || '',
      content: postData.content || '',
      authorId: postData.authorId,
      authorName: postData.authorName || author.displayName,
      createdAt: postData.createdAt || Timestamp.now(),
      updatedAt: postData.updatedAt || Timestamp.now(),
      likes: postData.likes || 0,
      tags: postData.tags || [],
      mediaUrl: postData.mediaUrl,
      thumbnailUrl: postData.thumbnailUrl,
      type: (postData.type || 'text') as PostType,
      isPublic: postData.isPublic ?? true,
      shares: postData.shares || 0,
      taggedUsers: postData.taggedUsers || [],
      comments: postData.comments || 0,
      author
    };
  };

  const loadPosts = useCallback(async () => {
    if (!user) return;
    try {
      const postsQuery = query(
        collection(db, 'posts'),
        where('authorId', '==', user.uid),
        orderBy('createdAt', 'desc'),
        limit(10)
      );
      const snapshot = await getDocs(postsQuery);
      const posts = await Promise.all(snapshot.docs.map(doc => processPost(doc)));
      setPosts(posts);
    } catch (error) {
      console.error('Error loading posts:', error);
    }
  }, [user]);

  const handleCreatePost = async (content: string) => {
    if (!user) return;
    
    try {
      const postRef = doc(collection(db, 'posts'));
      const newPost = {
        content,
        authorId: user.uid,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        likes: 0,
        comments: 0,
        shares: 0,
        type: 'text' as PostType,
        status: 'active',
        isPublic: true,
        tags: [],
        taggedUsers: [],
        engagement: {
          views: 0,
          uniqueViews: 0,
          saveCount: 0,
          reportCount: 0
        }
      };
      
      await setDoc(postRef, newPost);
      // Refresh posts after creating a new one
      loadPosts();
    } catch (error) {
      console.error('Error creating post:', error);
    }
  };

  useEffect(() => {
    async function redirectToProfile() {
      if (!user) return;

      try {
        // Get the user's profile data
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        const userData = userDoc.data() as User;

        if (userData?.username) {
          // Redirect to the user's profile page using their username
          router.push(`/${userData.username}`);
        } else {
          // If no username is set, redirect to complete profile
          router.push('/complete-profile');
        }
      } catch (error) {
        console.error('Error fetching user profile:', error);
      }
    }

    redirectToProfile();
  }, [user, router]);

  // Show loading state while redirecting
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-2xl mx-auto">
        {/* Floating Upload Button as Dialog Trigger */}
        <ContentUploadDialog
          onUploadComplete={loadPosts}
          triggerClassName="fixed bottom-6 right-6 z-50 bg-gradient-to-br from-pink-500 to-purple-600 text-white rounded-full shadow-lg p-4 hover:scale-105 transition-transform focus:outline-none focus:ring-2 focus:ring-pink-400"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5-5m0 0l5 5m-5-5v12" /></svg>
        </ContentUploadDialog>
        <div className="space-y-8">
          <Skeleton className="h-48 w-full rounded-lg" />
          <div className="space-y-4">
            <Skeleton className="h-96 w-full rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  );
} 
'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { CompactPost } from '@/components/posts/CompactPost';
import { PostWithAuthor } from '@/lib/types/post';
import { toast } from 'react-hot-toast';
import { useAuth } from '@/hooks/useAuth';

export default function PostPage() {
  const params = useParams() ?? {};
  const searchParams = useSearchParams() ?? { get: () => null };
  const [post, setPost] = useState<PostWithAuthor | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const postId = (params as any).postId as string;
  const showComments = searchParams.get('showComments') === 'true';
  const { user, loading: authLoading } = useAuth();
  const commentId = searchParams.get('commentId');
  const highlight = searchParams.get('highlight') === 'true';

  console.log('PostPage useAuth debug:', { user });

  if (authLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Please sign in to view this post.</h1>
        </div>
      </div>
    );
  }

  useEffect(() => {
    if (!postId) return;
    setLoading(true);
    const postRef = doc(db, 'posts', postId);
    const unsubscribe = onSnapshot(postRef, async (postSnap) => {
      if (!postSnap.exists()) {
        setError('Post not found');
        setLoading(false);
        return;
      }
      const postData = postSnap.data();
      const authorRef = doc(db, 'users', postData.authorId);
      const authorSnap = await getDoc(authorRef);
      const authorData = authorSnap.data();
      setPost({
        id: postSnap.id,
        ...postData,
        author: {
          id: authorData?.uid,
          displayName: authorData?.displayName,
          photoURL: authorData?.photoURL,
          username: authorData?.username
        }
      } as PostWithAuthor);
      setLoading(false);
    }, (err) => {
      console.error('Error listening to post:', err);
      setError('Failed to load post');
      setLoading(false);
    });
    return () => unsubscribe();
  }, [postId]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">{error}</h1>
        </div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Post not found</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <CompactPost
        post={post}
        currentUserId={user.uid}
        onPostDeleted={() => {}}
        commentId={commentId}
        highlight={highlight}
      />
    </div>
  );
} 
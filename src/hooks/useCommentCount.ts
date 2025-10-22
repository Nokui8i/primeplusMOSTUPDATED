import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';

export function useCommentCount(postId: string) {
  const [commentCount, setCommentCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('💬 useCommentCount: Setting up listener for postId:', postId)
    
    if (!postId) {
      console.log('💬 useCommentCount: No postId provided')
      setCommentCount(0);
      setLoading(false);
      return;
    }

    const commentsRef = collection(db, 'comments');
    const q = query(
      commentsRef,
      where('postId', '==', postId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const count = snapshot.docs.length;
      console.log('💬 useCommentCount: Comment count updated:', { postId, count });
      setCommentCount(count);
      setLoading(false);
    }, (error) => {
      console.error('❌ useCommentCount: Error:', error);
      setLoading(false);
    });

    return () => {
      console.log('💬 useCommentCount: Cleaning up listener for postId:', postId);
      unsubscribe();
    };
  }, [postId]);

  console.log('💬 useCommentCount: Returning:', { postId, commentCount, loading })
  return { commentCount, loading };
}

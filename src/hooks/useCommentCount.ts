import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export function useCommentCount(postId: string) {
  const [commentCount, setCommentCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!postId) {
      setCommentCount(0);
      setLoading(false);
      return;
    }

    console.log('[useCommentCount] Setting up listener for postId:', postId);

    const commentsRef = collection(db, 'comments');
    const q = query(
      commentsRef,
      where('postId', '==', postId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const count = snapshot.docs.length;
      console.log('[useCommentCount] Comment count updated:', count);
      setCommentCount(count);
      setLoading(false);
    }, (error) => {
      console.error('[useCommentCount] Error:', error);
      setLoading(false);
    });

    return () => {
      console.log('[useCommentCount] Cleaning up listener for postId:', postId);
      unsubscribe();
    };
  }, [postId]);

  return { commentCount, loading };
}

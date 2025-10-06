import React, { useEffect, useState } from 'react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Users } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';
import { useAuth } from '@/lib/firebase/auth';
import { db } from '@/lib/firebase';
import { collection, onSnapshot } from 'firebase/firestore';

interface LiveStreamFeedCardProps {
  streamId: string;
  title: string;
  description: string;
  author: {
    id: string;
    displayName: string;
    photoURL?: string;
    username?: string;
  };
  createdAt: Date;
  thumbnailUrl?: string;
  onEndStream?: () => void;
  onClick?: () => void;
}

export function LiveStreamFeedCard({
  streamId,
  title,
  description,
  author,
  createdAt,
  thumbnailUrl,
  onEndStream,
  onClick
}: LiveStreamFeedCardProps) {
  const { user } = useAuth();
  const isOwner = user && user.uid === author.id;
  const [viewerCount, setViewerCount] = useState(0);

  useEffect(() => {
    const viewersCol = collection(db, 'streams', streamId, 'viewers');
    const unsub = onSnapshot(viewersCol, (snapshot) => {
      const ids = snapshot.docs.map(doc => doc.id);
      console.log('Feed card viewers for', streamId, ':', ids);
      setViewerCount(snapshot.size);
    });
    return () => unsub();
  }, [streamId]);

  const handleEndStream = () => {
    if (onEndStream) {
      onEndStream();
    } else {
      alert('End Stream action not implemented.');
    }
  };

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl shadow-lg overflow-hidden border border-gray-200 dark:border-gray-800 relative">
      {/* LIVE Indicator */}
      <div className="absolute top-4 left-4 z-20 flex items-center gap-2">
        <span className="flex items-center gap-1 px-2 py-0.5 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-full text-xs font-bold shadow animate-pulse">
          <span className="w-2 h-2 bg-white rounded-full animate-ping mr-1" />
          LIVE
        </span>
        <span className="text-xs text-white bg-black/60 rounded px-2 py-0.5 ml-2 flex items-center gap-1">
          <Users className="w-4 h-4 inline-block mr-1" />
          {viewerCount} watching
        </span>
      </div>

      {/* Thumbnail or Placeholder */}
      <div onClick={onClick} style={{ cursor: onClick ? 'pointer' : undefined }}>
        {thumbnailUrl ? (
          <img src={thumbnailUrl} alt={title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            <span className="text-white text-lg font-bold">Live Stream</span>
          </div>
        )}
        <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
          <span className="bg-gradient-to-r from-blue-500 to-purple-600 text-white px-4 py-2 rounded-full text-base font-bold shadow opacity-0 group-hover:opacity-100 transition-opacity duration-200">Join Live Room</span>
        </div>
      </div>

      {/* Stream Info */}
      <div className="p-4 flex flex-col items-start">
        <div className="flex items-center gap-3 mb-2">
          <Avatar className="h-8 w-8">
            <AvatarImage src={author.photoURL || '/default-avatar.png'} alt={author.displayName} />
            <AvatarFallback>{author.displayName?.[0]?.toUpperCase() || '?'}</AvatarFallback>
          </Avatar>
          <span className="font-semibold text-gray-900 dark:text-gray-100">{author.displayName}</span>
          <span className="text-xs text-gray-500 dark:text-gray-400">• {formatDistanceToNow(createdAt, { addSuffix: true })}</span>
        </div>
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">{title}</h2>
        {description && (
          <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">{description}</p>
        )}
        <div className="flex gap-2 items-center mt-2">
          <button
            onClick={onClick}
            className="inline-block bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold px-4 py-1.5 rounded-full shadow transition-all duration-150 text-sm"
          >
            Join Live Room
          </button>
          {isOwner && (
            <button
              onClick={handleEndStream}
              className="inline-block bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-100 font-semibold px-4 py-1.5 rounded-full shadow transition-all duration-150 text-sm"
            >
              End Stream
            </button>
          )}
        </div>
      </div>
    </div>
  );
} 
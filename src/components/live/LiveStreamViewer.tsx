'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { doc, getDoc, onSnapshot, updateDoc, increment } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import LiveKitStream from './LiveKitStream';
import { Users, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';

interface LiveStreamViewerProps {
  streamId: string;
}

interface StreamData {
  title: string;
  description: string;
  username: string;
  startedAt: number;
  status: 'live' | 'ended';
  viewerCount: number;
}

export default function LiveStreamViewer({ streamId }: LiveStreamViewerProps) {
  const { user } = useAuth();
  const [streamData, setStreamData] = useState<StreamData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Fetch initial stream data
    const fetchStream = async () => {
      try {
        setIsLoading(true);
        const streamDoc = await getDoc(doc(db, 'streams', streamId));
        
        if (!streamDoc.exists()) {
          setError('Stream not found');
          setIsLoading(false);
          return;
        }
        
        const data = streamDoc.data() as StreamData;
        setStreamData(data);
        
        // Increment viewer count when a user joins
        if (data.status === 'live' && user) {
          await updateDoc(doc(db, 'streams', streamId), {
            viewerCount: increment(1)
          });
        }
      } catch (err) {
        console.error('Error fetching stream:', err);
        setError('Failed to load stream');
      } finally {
        setIsLoading(false);
      }
    };

    fetchStream();

    // Subscribe to real-time updates
    const unsubscribe = onSnapshot(doc(db, 'streams', streamId), (doc) => {
      if (doc.exists()) {
        setStreamData(doc.data() as StreamData);
      } else {
        setError('Stream no longer exists');
      }
    });

    // Cleanup: Decrement viewer count when leaving
    return () => {
      unsubscribe();
      if (user) {
        updateDoc(doc(db, 'streams', streamId), {
          viewerCount: increment(-1)
        }).catch(err => console.error('Error updating viewer count:', err));
      }
    };
  }, [streamId, user]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center w-full h-full min-h-[400px]">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center w-full h-full min-h-[400px] bg-gray-900 text-white">
        <h3 className="text-xl mb-4">{error}</h3>
        <Button onClick={() => window.history.back()}>Go Back</Button>
      </div>
    );
  }

  if (!streamData) {
    return null;
  }

  if (streamData.status !== 'live') {
    return (
      <div className="flex flex-col items-center justify-center w-full h-full min-h-[400px] bg-gray-900 text-white">
        <h3 className="text-xl mb-4">This stream has ended</h3>
        <Button onClick={() => window.history.back()}>Go Back</Button>
      </div>
    );
  }

  return (
    <div className="relative bg-black rounded-lg overflow-hidden">
      {/* Stream Info */}
      <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/70 to-transparent p-4 z-10">
        <h2 className="text-white text-lg font-bold">{streamData.title}</h2>
        <div className="flex items-center space-x-4 mt-2 text-white/80 text-sm">
          <div className="flex items-center">
            <Users className="w-4 h-4 mr-1" />
            {streamData.viewerCount} watching
          </div>
          <div className="flex items-center">
            <Calendar className="w-4 h-4 mr-1" />
            Started {formatDistanceToNow(streamData.startedAt, { addSuffix: true })}
          </div>
          <div>by {streamData.username}</div>
        </div>
      </div>

      {/* LiveKit Stream */}
      <div className="aspect-video">
        <LiveKitStream roomName={streamId} isHost={false} />
      </div>
      
      {/* Stream Description */}
      {streamData.description && (
        <div className="p-4 bg-gray-900 text-white border-t border-gray-800">
          <h3 className="text-lg font-medium mb-2">About this stream</h3>
          <p>{streamData.description}</p>
        </div>
      )}
    </div>
  );
} 
"use client";
import React, { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import LiveKitStream from '@/components/live/LiveKitStream';
import LiveChat from '@/components/live/LiveChat';
import { Avatar, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Camera, Users } from 'lucide-react';
import { doc, getDoc, updateDoc, onSnapshot, increment, collection, setDoc, deleteDoc, onSnapshot as onColSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Logo } from '@/components/common/Logo';
import { useAuth } from '@/hooks/useAuth';

export default function StreamerPage() {
  const router = useRouter();
  const params = useParams();
  const streamId = params?.streamId as string;
  const [stream, setStream] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ending, setEnding] = useState(false);
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | null>(null);
  const { user } = useAuth();
  const [viewerCount, setViewerCount] = useState<number>(1);
  const [isStreamInitialized, setIsStreamInitialized] = useState(false);

  // Initialize stream with retry logic
  useEffect(() => {
    if (!streamId) return;
    setLoading(true);
    
    const initializeStream = async () => {
      try {
        // First check if stream exists
        const streamDoc = await getDoc(doc(db, 'streams', streamId));
        if (!streamDoc.exists()) {
          setError('Stream not found');
          setLoading(false);
          return;
        }

        const streamData = streamDoc.data();
        
        // If stream is ended, redirect
        if (streamData.status === 'ended') {
          router.push('/profile');
          return;
        }
        // If stream is not live yet, show waiting state
        if (streamData.status !== 'live') {
          setStream(streamData);
          setLoading(false);
          return;
        }

        // Set stream data
        setStream(streamData);
        
        // Fetch user profile for avatar
        if (streamData.userId) {
          const userDoc = await getDoc(doc(db, 'users', streamData.userId));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            setProfilePhotoUrl(userData.photoURL || userData.profilePhotoUrl || null);
          }
        }

        // Mark stream as initialized
        setIsStreamInitialized(true);
        setLoading(false);
      } catch (err) {
        console.error('Error initializing stream:', err);
        setError('Failed to initialize stream');
        setLoading(false);
      }
    };

    initializeStream();

    // Real-time listener for stream updates
    const unsub = onSnapshot(doc(db, 'streams', streamId), async docSnap => {
      if (docSnap.exists()) {
        const streamData = docSnap.data();
        setStream(streamData);
        
        // Only redirect if:
        // 1. Stream is ended
        // 2. Not showing post stream dialog
        // 3. User is not the streamer (userId !== user.uid)
        if (streamData.status === 'ended' && streamData.userId !== user?.uid) {
          console.log('Real-time listener redirecting non-streamer to profile');
          router.push('/profile');
        }
      }
    });

    return () => unsub();
  }, [streamId, router, user?.uid]);

  // Only start stream after initialization
  useEffect(() => {
    if (!isStreamInitialized || !stream) return;

    const startStream = async () => {
      try {
        // Check for media devices
        const devices = await navigator.mediaDevices.enumerateDevices();
        const hasVideoDevices = devices.some(device => device.kind === 'videoinput');
        const hasAudioDevices = devices.some(device => device.kind === 'audioinput');

        if (!hasVideoDevices && !hasAudioDevices) {
          throw new Error('No audio or video devices found');
        }

        // Small delay to ensure everything is ready
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Stream is ready
        console.log('Stream initialized successfully');
      } catch (err) {
        console.error('Error starting stream:', err);
        setError(err instanceof Error ? err.message : 'Failed to start stream');
        handleEndStream();
      }
    };

    startStream();
  }, [isStreamInitialized, stream]);

  // Increment/decrement viewer count for streamer (atomic, robust, only once)
  useEffect(() => {
    if (!streamId || !user) return;
    let didIncrement = false;
    // Only increment if the user is the stream owner or streamer
    const incrementViewer = async () => {
      await updateDoc(doc(db, 'streams', streamId), { viewerCount: increment(1) });
      didIncrement = true;
    };
    incrementViewer();
    return () => {
      if (didIncrement) {
        updateDoc(doc(db, 'streams', streamId), { viewerCount: increment(-1) }).catch(() => {});
      }
    };
  }, [streamId, user]);

  // Real-time viewer presence system
  useEffect(() => {
    if (!streamId || !user) return;
    const viewerRef = doc(db, 'streams', streamId, 'viewers', user.uid);
    // Add presence doc on mount
    setDoc(viewerRef, { joinedAt: new Date() }).catch(() => {});
    // Remove presence doc on unmount
    return () => {
      deleteDoc(viewerRef).catch(() => {});
    };
  }, [streamId, user]);

  // Real-time viewer count listener with debug logging
  useEffect(() => {
    if (!streamId) return;
    const viewersCol = collection(db, 'streams', streamId, 'viewers');
    const unsub = onColSnapshot(viewersCol, (snapshot) => {
      const ids = snapshot.docs.map(doc => doc.id);
      console.log('Current viewers:', ids);
      setViewerCount(snapshot.size);
    });
    return () => unsub();
  }, [streamId]);

  const handleEndStream = useCallback(async () => {
    if (!streamId) return;
    setEnding(true);
    try {
      console.log('handleEndStream called');
      // Update stream status
      await updateDoc(doc(db, 'streams', streamId), {
        status: 'ended',
        endedAt: new Date(),
        updatedAt: new Date(),
      });
      await updateDoc(doc(db, 'posts', streamId), {
        status: 'ended',
        updatedAt: new Date(),
      });
      
      // Redirect to profile
      router.push('/profile');
    } catch (err) {
      console.error('Error in handleEndStream:', err);
      setError('Failed to end stream. Please try again.');
    } finally {
      setEnding(false);
    }
  }, [streamId, router]);

  // End stream if streamer disconnects in any way
  useEffect(() => {
    const endStream = async () => {
      try {
        await handleEndStream();
      } catch (error) {
        console.error('Error ending stream:', error);
      }
    };

    // Handle tab close, browser close, PC shutdown
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (navigator.sendBeacon) {
        const url = `${window.location.origin}/api/streams/${streamId}/end`;
        const data = new Blob([JSON.stringify({})], { type: 'application/json' });
        navigator.sendBeacon(url, data);
      } else {
        endStream();
      }
    };

    // Handle internet disconnection
    const handleOffline = () => {
      endStream();
    };

    // Add all event listeners
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('offline', handleOffline);

    // Cleanup function that runs on unmount
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('offline', handleOffline);
    };
  }, [handleEndStream]);

  // Add periodic connection check
  useEffect(() => {
    const checkConnection = async () => {
      try {
        // Try to fetch a small file to check connection
        await fetch('/api/ping', { 
          method: 'HEAD',
          cache: 'no-cache'
        });
      } catch (error) {
        // If fetch fails, end the stream
        handleEndStream();
      }
    };

    const interval = setInterval(checkConnection, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, [handleEndStream]);

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen bg-black text-white">Loading…</div>;
  }
  if (error || !stream) {
    return <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white">
      <Camera className="w-24 h-24 text-gray-700 mb-6" />
      <div className="text-2xl font-bold mb-2">{error || 'Stream not found'}</div>
      <Button onClick={() => router.push('/profile')}>Go Back</Button>
    </div>;
  }
  if (stream.status === 'ended') {
    return <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white">
      <div className="text-2xl font-bold mb-2">This stream has ended</div>
      <Button onClick={() => router.push('/profile')}>Go Back</Button>
    </div>;
  }
  if (stream.status !== 'live') {
    return <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white">
      <div className="text-2xl font-bold mb-2">Waiting for stream to go live…</div>
    </div>;
  }

  return (
    <div className="relative w-full min-h-screen bg-gradient-to-br from-blue-500 via-purple-500 to-purple-700 flex flex-col overflow-hidden">
      {/* Decorative Blobs */}
      <div className="absolute top-[-10%] right-[-5%] w-[400px] h-[400px] rounded-full bg-purple-200 opacity-40 blur-3xl z-0"></div>
      <div className="absolute bottom-[10%] left-[-5%] w-[300px] h-[300px] rounded-full bg-pink-200 opacity-30 blur-2xl z-0"></div>
      <div className="absolute top-[30%] left-[40%] w-[200px] h-[200px] rounded-full bg-blue-200 opacity-20 blur-2xl z-0"></div>

      {/* Top Bar */}
      <div className="relative z-10 w-full flex flex-col md:flex-row items-center justify-between px-4 md:px-10 py-4 bg-white/80 border-b border-gray-200 shadow-sm backdrop-blur-md">
        {/* Logo and Streamer Info */}
        <div className="flex items-center gap-6 w-full md:w-auto">
          <Logo size="md" showText={false} />
          <Avatar className="w-10 h-10 border-2 border-white">
            <AvatarImage src={profilePhotoUrl || '/default-avatar.png'} />
            <span className="flex items-center justify-center w-full h-full text-lg font-bold text-gray-400">
              {stream.username ? stream.username[0].toUpperCase() : "U"}
            </span>
          </Avatar>
          <div className="flex flex-col">
            <span className="font-semibold text-gray-900 text-base">@{stream.username}</span>
            <span className="text-xs text-gray-500 font-medium">{stream.title || 'Untitled Stream'}</span>
          </div>
        </div>
        {/* Centered LIVE and Watching Counter */}
        <div className="flex flex-col md:flex-row items-center justify-center gap-3 flex-1">
          <span className="flex items-center gap-2 px-3 py-1 bg-[#e53935] text-white text-xs font-bold rounded-full">
            <span className="w-2 h-2 bg-white rounded-full animate-pulse" /> LIVE
          </span>
          <span className="flex items-center gap-1 text-xs text-gray-700 font-semibold">
            <Users className="w-4 h-4" />
            {viewerCount} watching
          </span>
        </div>
        <Button
          className="mt-4 md:mt-0 px-2 py-0.5 text-xs rounded-full shadow-lg text-white bg-gradient-to-br from-pink-500 to-purple-600 hover:from-purple-600 hover:to-pink-500 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:ring-offset-2 transition-colors"
          onClick={handleEndStream}
          disabled={ending}
        >
          {ending ? 'Ending…' : 'End Stream'}
        </Button>
      </div>
      {/* Main Content */}
      <div className="relative z-10 flex-1 flex flex-col md:flex-row gap-0 md:gap-6 w-full max-w-[1600px] mx-auto py-4 px-2 md:px-8">
        {/* Video Area */}
        <div className="flex-1 flex items-center justify-center">
          <div className="w-full max-w-5xl aspect-video bg-gray-900 rounded-2xl shadow-2xl border border-white/30 flex items-center justify-center overflow-hidden">
            <LiveKitStream roomName={streamId} isHost={true} />
          </div>
        </div>
        {/* Chat Area */}
        <div className="w-full md:w-[400px] flex flex-col bg-white/60 backdrop-blur-md rounded-2xl shadow-2xl border border-white/30 overflow-hidden mt-6 md:mt-0">
          <div className="flex-1 flex flex-col h-[60vh] md:h-full">
            <LiveChat streamId={streamId} />
          </div>
        </div>
      </div>
    </div>
  );
} 
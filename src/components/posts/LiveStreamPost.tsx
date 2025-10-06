import React, { useEffect, useState, useRef } from 'react';
import { StreamingClient } from '@/lib/streaming/client';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { formatTime } from '@/lib/utils/time';
import { Play, Pause, SkipBack, SkipForward, Users } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';
import LiveChat from '@/components/live/LiveChat';

interface LiveStreamPostProps {
  streamId: string;
  title: string;
  description: string;
  author: {
    id: string;
    displayName: string;
    photoURL?: string;
    username?: string;
  };
  viewerCount: number;
  createdAt: Date;
  thumbnailUrl?: string;
}

export function LiveStreamPost({
  streamId,
  title,
  description,
  author,
  viewerCount,
  createdAt,
  thumbnailUrl
}: LiveStreamPostProps) {
  const [streamingClient, setStreamingClient] = useState<StreamingClient | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isLive, setIsLive] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const initializeViewer = async () => {
      try {
        setIsConnecting(true);
        const client = new StreamingClient(
          streamId,
          'viewer',
          false,
          {
            onStateChange: (state) => {
              setIsLive(state.isLive);
              setCurrentTime(state.currentTime);
              setDuration(state.duration);
              setIsPlaying(state.isPlaying);
            },
            onError: (error) => {
              console.error('Streaming error:', error);
              toast({
                title: 'Stream Error',
                description: 'Failed to connect to stream. Please try again.',
                variant: 'destructive'
              });
            }
          }
        );

        await client.connect();
        setStreamingClient(client);
      } catch (error) {
        console.error('Error initializing viewer:', error);
        toast({
          title: 'Connection Error',
          description: 'Failed to connect to stream. Please try again.',
          variant: 'destructive'
        });
      } finally {
        setIsConnecting(false);
      }
    };

    initializeViewer();

    return () => {
      streamingClient?.cleanup();
    };
  }, [streamId]);

  const handleSeek = (value: number[]) => {
    const time = value[0];
    streamingClient?.seek(time);
  };

  const handlePlayPause = () => {
    streamingClient?.togglePlay();
  };

  const handleSkipBack = () => {
    const newTime = Math.max(0, currentTime - 10);
    streamingClient?.seek(newTime);
  };

  const handleSkipForward = () => {
    const newTime = Math.min(duration, currentTime + 10);
    streamingClient?.seek(newTime);
  };

  return (
    <div className="bg-gradient-to-r from-red-100/80 to-pink-100/80 dark:from-gray-900 dark:to-gray-800 rounded-xl shadow-lg overflow-hidden border-2 border-red-500/60 relative">
      {/* LIVE Indicator */}
      <div className="absolute top-4 left-4 z-20 flex items-center gap-2">
        <span className="flex items-center gap-1 px-3 py-1 bg-red-600 text-white rounded-full text-xs font-bold shadow-lg animate-pulse">
          <span className="w-2 h-2 bg-white rounded-full animate-ping mr-1" />
          LIVE
        </span>
        <span className="text-xs text-white bg-black/60 rounded px-2 py-0.5 ml-2 flex items-center gap-1">
          <Users className="w-4 h-4 inline-block mr-1" />
          {viewerCount} watching
        </span>
      </div>

      {/* Stream Video */}
      <div className="relative aspect-video bg-black group">
        <Link href={`/watch/${streamId}`} className="absolute inset-0 z-10 cursor-pointer group-hover:bg-black/30 transition-colors duration-200" aria-label="Join live stream" />
        <video
          ref={videoRef}
          className="w-full h-full"
          autoPlay
          playsInline
          controls={false}
          disablePictureInPicture
          controlsList="nodownload nofullscreen noremoteplayback"
        />
        {isConnecting && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
          </div>
        )}
        <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
          <span className="bg-red-600/90 text-white px-6 py-3 rounded-full text-xl font-bold shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200">Join Live Room</span>
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
        <Link href={`/watch/${streamId}`} className="mt-2 inline-block bg-red-600 hover:bg-red-700 text-white font-semibold px-5 py-2 rounded-full shadow transition-all duration-150 text-base">Join Live Room</Link>
      </div>
    </div>
  );
} 
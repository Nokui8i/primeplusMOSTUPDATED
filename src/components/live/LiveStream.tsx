'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Camera, Mic, MicOff, Video, VideoOff, Settings, Users, Share2, Clock } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { doc, updateDoc, onSnapshot, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { StreamingClient } from '@/lib/streaming/client';
import { toast } from '@/components/ui/use-toast';
import LiveKitStream from './LiveKitStream';
import { StreamQualityIndicator } from './StreamQualityIndicator';
import { StreamQualityMonitor } from '@/lib/streaming/quality-monitor';
import { AdaptiveBitrateManager } from '@/lib/streaming/adaptive-bitrate';

interface StreamSettings {
  title: string;
  description: string;
  isPublic: boolean;
  quality: 'auto' | '1080p' | '720p' | '480p';
}

interface LiveStreamProps {
  onStreamStart?: (streamId: string) => void;
}

export default function LiveStream({ onStreamStart }: LiveStreamProps) {
  const { user } = useAuth();
  const [isStreaming, setIsStreaming] = useState(false);
  const [viewerCount, setViewerCount] = useState(0);
  const [settings, setSettings] = useState<StreamSettings>({
    title: '',
    description: '',
    isPublic: true,
    quality: 'auto'
  });
  const [showSettings, setShowSettings] = useState(false);
  const streamId = useRef<string>(`stream_${user?.uid}_${Date.now()}`);
  const [qualityMonitor, setQualityMonitor] = useState<StreamQualityMonitor | null>(null);
  const [adaptiveBitrateManager, setAdaptiveBitrateManager] = useState<AdaptiveBitrateManager | null>(null);

  useEffect(() => {
    if (!user) return;
    // Listen to viewer count
    const unsubscribe = onSnapshot(doc(db, 'streams', streamId.current), (doc) => {
      if (doc.exists()) {
        setViewerCount(doc.data().viewerCount || 0);
      }
    });
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (streamId.current) {
      // Quality monitoring temporarily disabled due to type issues
      // const monitor = new StreamQualityMonitor('1080p', (preset) => {
      //   console.log('Quality changed to:', preset.name);
      // });
      // monitor.startMonitoring(streamId.current);
      // setQualityMonitor(monitor);

      return () => {
        // monitor.stopMonitoring();
      };
    }
  }, [streamId.current]);

  useEffect(() => {
    if (streamId.current) {
      // Initialize adaptive bitrate manager
      const manager = new AdaptiveBitrateManager((preset) => {
        // Update stream quality when it changes
        if (streamId.current) {
          // This is a placeholder implementation. You might want to implement the logic to update the stream quality
          console.log('Adaptive bitrate changed to:', preset.name);
        }
      });
      setAdaptiveBitrateManager(manager);

      // Start monitoring - temporarily disabled due to type issues
      // manager.startMonitoring(streamId.current);

      return () => {
        // manager.stopMonitoring();
      };
    }
  }, [streamId.current]);

  const startStream = async () => {
    if (!user) return;
    // Create stream document in Firestore
    await updateDoc(doc(db, 'streams', streamId.current), {
      userId: user.uid,
      username: user.displayName || 'Anonymous',
      title: settings.title,
      description: settings.description,
      startedAt: Date.now(),
      status: 'live',
      viewerCount: 0,
      isPublic: settings.isPublic,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    setIsStreaming(true);
    if (onStreamStart) {
      onStreamStart(streamId.current);
    }
  };

  const stopStream = async () => {
    setIsStreaming(false);
    
    try {
      // Update Firestore to mark stream as ended
      // Don't delete thumbnail yet - let the user decide if they want to save as post
      await updateDoc(doc(db, 'streams', streamId.current), {
        status: 'ended',
        endedAt: Date.now(),
        updatedAt: Date.now(),
      });
      
      // Note: Thumbnail cleanup will be handled by:
      // 1. PostStreamDialog - keeps thumbnail if saved as post
      // 2. A cleanup function/trigger that deletes thumbnails from ended streams after 24 hours if not saved
    } catch (error) {
      console.error('Error stopping stream:', error);
    }
  };

  return (
    <div className="relative bg-black rounded-lg overflow-hidden">
      {/* Stream Info */}
      <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-10">
        {isStreaming && (
          <div className="flex items-center space-x-4">
            <div className="bg-red-600 text-white px-3 py-1 rounded-full text-sm flex items-center">
              <span className="w-2 h-2 bg-white rounded-full mr-2 animate-pulse" />
              LIVE
            </div>
            <div className="bg-black/60 text-white px-3 py-1 rounded-full text-sm flex items-center">
              <Users className="w-4 h-4 mr-1" />
              {viewerCount}
            </div>
          </div>
        )}
      </div>
      {/* Stream Settings Dialog */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Stream Settings</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Title</Label>
              <Input
                value={settings.title}
                onChange={(e) => setSettings({ ...settings, title: e.target.value })}
                placeholder="Enter stream title"
              />
            </div>
            <div>
              <Label>Description</Label>
              <Input
                value={settings.description}
                onChange={(e) => setSettings({ ...settings, description: e.target.value })}
                placeholder="Enter stream description"
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>Public Stream</Label>
              <Switch
                checked={settings.isPublic}
                onCheckedChange={(checked) => setSettings({ ...settings, isPublic: checked })}
              />
            </div>
            <Button onClick={() => {
              setShowSettings(false);
              startStream();
            }}>
              Start Stream
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      {/* Main Streaming Area */}
      <div className="aspect-video bg-gray-900">
        {isStreaming ? (
          <LiveKitStream roomName={streamId.current} isHost={true} />
        ) : (
          <div className="flex flex-col items-center justify-center h-full space-y-4">
            <Button onClick={() => setShowSettings(true)}>
              Go Live
            </Button>
          </div>
        )}
      </div>
      {/* End Stream Button */}
      {isStreaming && (
        <Button
          variant="destructive"
          size="sm"
          className="absolute bottom-4 right-4 z-10"
          onClick={async () => {
            if (window.confirm('Are you sure you want to end the stream?')) {
              await stopStream();
            }
          }}
        >
          End Stream
        </Button>
      )}
      {/* {qualityMonitor && streamId.current && (
        <div className="absolute bottom-4 right-4 z-10">
          <StreamQualityIndicator 
            qualityMonitor={qualityMonitor}
            stream={streamId.current}
          />
        </div>
      )} */}
      {adaptiveBitrateManager && (
        <div className="absolute bottom-4 right-4 bg-black/50 text-white px-3 py-1 rounded-full text-sm">
          {adaptiveBitrateManager.getCurrentPreset().name.toUpperCase()}
        </div>
      )}
    </div>
  );
} 
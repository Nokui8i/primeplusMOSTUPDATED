import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { X, Upload, Image as ImageIcon, Trash2, Smartphone, Crop, Info } from 'lucide-react';
import { useAuth } from '@/lib/firebase/auth';
import { StreamingClient } from '@/lib/streaming/client';
import { toast } from 'sonner';
// Firebase Storage imports removed - now using AWS S3
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Cropper } from 'react-cropper';
import 'cropperjs/dist/cropper.css';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface LiveStreamDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onStreamStart: (streamId: string) => void;
}

interface StreamMetadata {
  title: string;
  description: string;
  userId: string;
  username: string;
  startedAt: number;
  endedAt?: number;
  status: 'live' | 'ended';
  viewerCount: number;
  thumbnail?: string | null;
}

interface StreamSettings {
  title: string;
  description: string;
  isPublic: boolean;
  quality: 'auto' | '4k' | '2k' | '1080p' | '720p' | '480p';
  saveAsPost: boolean;
}

export function LiveStreamDialog({ isOpen, onClose, onStreamStart }: LiveStreamDialogProps) {
  const { user } = useAuth();
  const [description, setDescription] = useState('');
  const [showCommands, setShowCommands] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  const [thumbnail, setThumbnail] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [deviceError, setDeviceError] = useState<string | null>(null);
  const [hasVideo, setHasVideo] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [chatEnabled, setChatEnabled] = useState(true);
  const [chatVisibility, setChatVisibility] = useState<'public' | 'private'>('public');
  const [audioInputs, setAudioInputs] = useState<MediaDeviceInfo[]>([]);
  const [videoInputs, setVideoInputs] = useState<MediaDeviceInfo[]>([]);
  const [settings, setSettings] = useState<StreamSettings>({
    title: '',
    description: '',
    isPublic: true,
    quality: 'auto',
    saveAsPost: false
  });
  const [showThumbnailConfirm, setShowThumbnailConfirm] = useState(false);
  const [pendingThumbnail, setPendingThumbnail] = useState<File | null>(null);
  const [pendingThumbnailPreview, setPendingThumbnailPreview] = useState<string | null>(null);
  const [isCropping, setIsCropping] = useState(false);
  const cropperRef = useRef<any>(null);

  useEffect(() => {
    // Check if device is mobile
    const checkMobile = () => {
      const userAgent = navigator.userAgent.toLowerCase();
      const isMobileDevice = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
      setIsMobile(isMobileDevice);
    };
    checkMobile();
  }, []);

  // Detect audio/video input devices in real time
  useEffect(() => {
    const updateDevices = async () => {
      if (
        typeof navigator === 'undefined' ||
        !navigator.mediaDevices ||
        typeof navigator.mediaDevices.enumerateDevices !== 'function'
      ) {
        setAudioInputs([]);
        setVideoInputs([]);
        return;
      }
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        setAudioInputs(devices.filter(d => d.kind === 'audioinput'));
        setVideoInputs(devices.filter(d => d.kind === 'videoinput'));
      } catch (err) {
        setAudioInputs([]);
        setVideoInputs([]);
      }
    };
    updateDevices();
    if (
      typeof navigator !== 'undefined' &&
      navigator.mediaDevices &&
      typeof navigator.mediaDevices.addEventListener === 'function'
    ) {
      navigator.mediaDevices.addEventListener('devicechange', updateDevices);
      return () => {
        if (
          typeof navigator !== 'undefined' &&
          navigator.mediaDevices &&
          typeof navigator.mediaDevices.removeEventListener === 'function'
        ) {
          navigator.mediaDevices.removeEventListener('devicechange', updateDevices);
        }
      };
    }
    return undefined;
  }, []);

  const handleThumbnailChange = (file: File) => {
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPendingThumbnailPreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    setPendingThumbnail(file);
    setShowThumbnailConfirm(true);
  };

  const confirmThumbnail = async () => {
    if (pendingThumbnailPreview && isCropping && cropperRef.current) {
      const cropper = cropperRef.current.cropper;
      const croppedCanvas = cropper.getCroppedCanvas();
      if (croppedCanvas) {
        croppedCanvas.toBlob((blob: Blob | null) => {
          if (blob) {
            const file = new File([blob], 'cropped-thumbnail.png', { type: 'image/png' });
            setThumbnail(file);
            setThumbnailPreview(URL.createObjectURL(blob));
          }
          setPendingThumbnail(null);
          setPendingThumbnailPreview(null);
          setShowThumbnailConfirm(false);
          setIsCropping(false);
        }, 'image/png');
        return;
      }
    } else {
      setThumbnail(pendingThumbnail);
      setThumbnailPreview(pendingThumbnailPreview);
      setPendingThumbnail(null);
      setPendingThumbnailPreview(null);
      setShowThumbnailConfirm(false);
      setIsCropping(false);
    }
  };

  const cancelThumbnail = () => {
    setPendingThumbnail(null);
    setPendingThumbnailPreview(null);
    setShowThumbnailConfirm(false);
  };

  const onDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file) {
      handleThumbnailChange(file);
    }
  }, []);

  const onDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const checkDevices = async () => {
    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices ||
      typeof navigator.mediaDevices.enumerateDevices !== 'function'
    ) {
      setDeviceError(
        'Your browser does not support live streaming. Please use the latest version of Safari on iOS or Chrome on Android.'
      );
      return false;
    }
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const hasAudio = devices.some(device => device.kind === 'audioinput');
      const hasVideo = devices.some(device => device.kind === 'videoinput');

      setHasVideo(hasVideo);
      if (!hasAudio && !hasVideo) {
        setDeviceError('A microphone or camera is required to start a live stream. Please connect at least one and try again.');
        return false;
      }
      setDeviceError(null);
      return { hasAudio, hasVideo };
    } catch (error) {
      console.error('Error checking devices:', error);
      setDeviceError('Unable to access your microphone or camera. Please check your browser permissions.');
      return false;
    }
  };

  const handleStartStream = async () => {
    if (!user) {
      toast.error('You must be logged in to start a stream');
      return;
    }

    if (!description.trim()) {
      toast.error('Please enter a stream description');
      return;
    }

    try {
      setIsStarting(true);
      setDeviceError(null);

      // First request permissions
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (error) {
        console.error('Error requesting audio permission:', error);
        setDeviceError('Please allow microphone access to start streaming.');
        setIsStarting(false);
        return;
      }

      // Then check for available devices
      const deviceStatus = await checkDevices();
      if (!deviceStatus) {
        setIsStarting(false);
        return;
      }
      const { hasAudio, hasVideo } = deviceStatus;

      const streamId = `stream_${user.uid}_${Date.now()}`;
      const client = new StreamingClient(streamId, user.uid, true);

      // Get media stream with at least one of audio or video
      let stream: MediaStream;
      try {
        if (isMobile) {
          stream = await navigator.mediaDevices.getUserMedia({
            video: hasVideo ? { facingMode: 'environment' } : false,
            audio: hasAudio
          });
        } else {
          stream = await navigator.mediaDevices.getUserMedia({
            video: hasVideo,
            audio: hasAudio
          });
        }
      } catch (error) {
        console.error('Error accessing media devices:', error);
        setDeviceError('Could not access your microphone or camera. Please check your device and browser permissions.');
        setIsStarting(false);
        return;
      }

      // 1. Create the stream document in Firestore
      const streamRef = doc(db, 'streams', streamId);
      await setDoc(streamRef, {
        userId: user.uid,
        username: user.displayName || 'Anonymous',
        title: description.trim(),
        description: description.trim(),
        startedAt: Date.now(),
        status: 'live',
        viewerCount: 0,
        chatEnabled,
        chatVisibility,
        thumbnail: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      // 2. Upload the thumbnail (if any)
      let thumbnailUrl: string | null = null;
      if (thumbnail) {
        try {
          thumbnailUrl = await uploadThumbnail(thumbnail, streamId);
          await setDoc(streamRef, { thumbnail: thumbnailUrl }, { merge: true });
        } catch (err) {
          console.error('Thumbnail upload failed:', err);
          toast.error('Thumbnail upload failed, continuing without thumbnail.');
        }
      }

      // 3. Create the post for the stream
      const postRef = doc(db, 'posts', streamId);
      await setDoc(postRef, {
        id: streamId,
        streamId: streamId,
        authorId: user.uid,
        content: description.trim(),
        type: 'live_stream',
        title: description.trim(),
        viewerCount: 0,
        status: 'live',
        likes: 0,
        comments: 0,
        thumbnailUrl,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      // 4. Connect to streaming service
      try {
        await client.connect();
        await client.startBroadcasting(stream, {
          title: description.trim(),
          description: description.trim(),
          userId: user.uid,
          username: user.displayName || 'Anonymous',
          startedAt: Date.now(),
          thumbnail: thumbnailUrl
        });

        onStreamStart(streamId);
        onClose();
      } catch (error) {
        console.error('Error connecting to streaming service:', error);
        toast.error('Failed to connect to streaming service. Please try again.');
        // Clean up the stream document if connection fails
        await setDoc(streamRef, { status: 'ended' }, { merge: true });
        setIsStarting(false);
        return;
      }
    } catch (error) {
      console.error('Error starting stream:', error);
      setDeviceError('Failed to start stream. Please check your device and try again.');
    } finally {
      setIsStarting(false);
    }
  };

  const uploadThumbnail = async (file: File, streamId: string): Promise<string> => {
    try {
      const { uploadToS3, generateS3Key } = await import('@/lib/aws/s3');
      const s3Key = generateS3Key(streamId, `thumbnail-${Date.now()}_${file.name}`, 'images');
      return await uploadToS3(file, s3Key);
    } catch (error) {
      console.error('Error uploading thumbnail:', error);
      throw new Error('Failed to upload thumbnail');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] bg-gray-900 text-white">
        <DialogHeader className="border-b border-gray-800 px-3 py-2">
          <DialogTitle className="text-base font-semibold text-center">Start Live Stream</DialogTitle>
          <Button
            className="absolute right-1.5 top-1.5 h-7 w-7 rounded-full hover:bg-gray-800"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </DialogHeader>

        <div className="p-4 space-y-4">
          {isMobile && (
            <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-blue-400 text-sm flex items-center gap-2">
              <Smartphone className="w-4 h-4" />
              <span>Mobile device detected. Using back camera if available.</span>
            </div>
          )}

          {deviceError && (
            <div className={`p-3 rounded-lg text-sm ${
              deviceError.includes('required') 
                ? 'bg-red-500/10 border border-red-500/20 text-red-400'
                : 'bg-yellow-500/10 border border-yellow-500/20 text-yellow-400'
            }`}>
              {deviceError}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="description">Stream Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's your stream about?"
              className="bg-gray-800 border-gray-700 min-h-[100px]"
            />
          </div>

          <div className="space-y-2">
            <Label>Stream Thumbnail</Label>
            <div
              className={`relative border-2 border-dashed rounded-lg p-2 transition-colors ${
                isDragging 
                  ? 'border-blue-500 bg-blue-500/10' 
                  : 'border-gray-700 hover:border-gray-600'
              }`}
              onDrop={onDrop}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
            >
              <input
                type="file"
                id="thumbnail-upload"
                accept="image/*"
                onChange={(e) => e.target.files?.[0] && handleThumbnailChange(e.target.files[0])}
                className="sr-only"
              />
              
              {thumbnailPreview ? (
                <div className="flex flex-col gap-2">
                  <div className="relative w-full max-w-[200px] mx-auto aspect-video rounded-lg overflow-hidden">
                    <img
                      src={thumbnailPreview}
                      alt="Stream thumbnail"
                      className="w-full h-full object-cover"
                    />
                    <Button
                      type="button"
                      className="absolute top-1 right-1 h-6 w-6 rounded-full bg-black/50 hover:bg-black/70"
                      onClick={() => {
                        setThumbnail(null);
                        setThumbnailPreview(null);
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="flex justify-center">
                    <Button
                      type="button"
                      className="text-xs cursor-pointer bg-gray-800 border-gray-700 hover:bg-gray-700"
                      onClick={() => document.getElementById('thumbnail-upload')?.click()}
                    >
                      <Upload className="w-3 h-3 mr-1" />
                      Change
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-3 text-center">
                  <ImageIcon className="w-8 h-8 text-gray-500 mb-1" />
                  <p className="text-xs text-gray-400 mb-1">
                    Drop image or click to upload
                  </p>
                  <Button
                    type="button"
                    className="text-xs cursor-pointer bg-gray-800 border-gray-700 hover:bg-gray-700"
                    onClick={() => document.getElementById('thumbnail-upload')?.click()}
                  >
                    <Upload className="w-3 h-3 mr-1" />
                    Upload
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Thumbnail Confirmation Dialog */}
          <Dialog open={showThumbnailConfirm} onOpenChange={setShowThumbnailConfirm}>
            <DialogContent className="sm:max-w-[90vw] md:max-w-[800px] max-h-[90vh] overflow-y-auto bg-gray-900 text-white">
              <DialogHeader className="border-b border-gray-800 px-3 py-2">
                <DialogTitle className="text-base font-semibold text-center">Confirm Thumbnail</DialogTitle>
              </DialogHeader>
              {pendingThumbnailPreview && (
                <div className="relative p-4 flex flex-col items-center">
                  {!isCropping ? (
                    <>
                      <div className="relative w-full max-w-2xl bg-black rounded-lg overflow-hidden">
                        <img
                          src={pendingThumbnailPreview}
                          alt="Stream thumbnail preview"
                          className="w-full h-auto object-contain"
                          style={{ maxHeight: '400px' }}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          className="absolute top-2 right-2 bg-white/80 hover:bg-white text-black rounded-full p-2 shadow"
                          onClick={() => setIsCropping(true)}
                          aria-label="Crop Thumbnail"
                        >
                          <Crop className="w-5 h-5" />
                        </Button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="relative w-full max-w-2xl h-[400px] bg-black rounded-lg overflow-hidden">
                        <Cropper
                          src={pendingThumbnailPreview}
                          style={{ height: 400, width: '100%' }}
                          initialAspectRatio={16 / 9}
                          aspectRatio={16 / 9}
                          guides={true}
                          viewMode={1}
                          dragMode="move"
                          ref={cropperRef}
                          background={false}
                          responsive={true}
                          autoCropArea={1}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          className="absolute top-2 right-2 bg-white/80 hover:bg-white text-black rounded-full p-2 shadow"
                          onClick={() => setIsCropping(false)}
                          aria-label="Cancel Crop"
                        >
                          <X className="w-5 h-5" />
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              )}
              <div className="flex justify-end gap-2 p-4 border-t border-gray-800">
                <Button 
                  variant="outline" 
                  onClick={cancelThumbnail}
                  className="bg-white text-black hover:bg-gray-100"
                >
                  Cancel
                </Button>
                <Button 
                  onClick={confirmThumbnail}
                  className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transition-all duration-200"
                >
                  Confirm
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <div className="space-y-2">
            <Label className="text-sm">Chat Settings</Label>
            <div className="flex items-center gap-2 text-xs">
              <Switch id="allow-chat" checked={chatEnabled} onCheckedChange={setChatEnabled} className="scale-75" />
              <Label htmlFor="allow-chat" className="text-xs">Allow Chat</Label>
            </div>
            {chatEnabled && (
              <div className="flex items-center gap-2 mt-1 text-xs">
                <label htmlFor="chat-visibility" className="flex items-center gap-1 cursor-pointer select-none">
                  <input
                    id="chat-visibility"
                    type="checkbox"
                    checked={chatVisibility === 'private'}
                    onChange={e => setChatVisibility(e.target.checked ? 'private' : 'public')}
                    className="accent-blue-500 w-4 h-4 rounded border-gray-400 focus:ring-0 focus:outline-none"
                  />
                  <span>Private Chat</span>
                </label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="ml-1 cursor-pointer text-blue-400"><Info className="w-4 h-4" /></span>
                    </TooltipTrigger>
                    <TooltipContent className="bg-gray-900 text-white text-xs max-w-xs">
                      <div className="font-semibold mb-1">Chat Visibility</div>
                      <div>
                        If this is checked, only you and the person who sent a message can see it.<br/>
                        If not checked, everyone in the stream can see all messages.
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            )}
          </div>

          {/* Device detection status */}
          <div className="space-y-2">
            <Label>Device Status</Label>
            <div className="flex flex-row gap-6 text-base items-center">
              <span className="flex items-center gap-2">
                Microphone
                {audioInputs.length > 0 ? (
                  <span className="text-green-400 font-bold">✔</span>
                ) : (
                  <span className="text-red-400 font-bold">✖</span>
                )}
              </span>
              <span className="flex items-center gap-2">
                Camera
                {videoInputs.length > 0 ? (
                  <span className="text-green-400 font-bold">✔</span>
                ) : (
                  <span className="text-red-400 font-bold">✖</span>
                )}
              </span>
            </div>
          </div>

          <Button
            className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transition-all duration-200"
            onClick={handleStartStream}
            disabled={isStarting || !description.trim()}
          >
            {isStarting ? 'Starting Stream...' : 'Go Live'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
} 
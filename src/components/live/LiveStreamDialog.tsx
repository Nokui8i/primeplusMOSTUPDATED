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

  // Request permissions and detect audio/video input devices in real time
  useEffect(() => {
    const requestPermissionsAndUpdateDevices = async () => {
      if (
        typeof navigator === 'undefined' ||
        !navigator.mediaDevices ||
        typeof navigator.mediaDevices.enumerateDevices !== 'function'
      ) {
        setAudioInputs([]);
        setVideoInputs([]);
        return;
      }

      // Request permissions first to get accurate device detection
      try {
        // Request minimal permissions (audio only, no video yet)
        // This allows us to enumerate devices properly
        const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: true,
          video: false 
        });
        // Stop the stream immediately - we just needed permission
        stream.getTracks().forEach(track => track.stop());
      } catch (permissionError) {
        console.log('Permission not granted yet, device detection may be limited');
        // Continue anyway - will show limited info
      }

      // Now enumerate devices
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        setAudioInputs(devices.filter(d => d.kind === 'audioinput'));
        setVideoInputs(devices.filter(d => d.kind === 'videoinput'));
      } catch (err) {
        setAudioInputs([]);
        setVideoInputs([]);
      }
    };

    if (isOpen) {
      requestPermissionsAndUpdateDevices();
    }

    // Listen for device changes
    const updateDevices = async () => {
      if (
        typeof navigator === 'undefined' ||
        !navigator.mediaDevices ||
        typeof navigator.mediaDevices.enumerateDevices !== 'function'
      ) {
        return;
      }
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        setAudioInputs(devices.filter(d => d.kind === 'audioinput'));
        setVideoInputs(devices.filter(d => d.kind === 'videoinput'));
      } catch (err) {
        console.error('Error updating devices:', err);
      }
    };

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
  }, [isOpen]);

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
      <DialogContent 
        className="sm:max-w-[500px] border-0 overflow-hidden p-0 [&>button]:hidden"
        style={{
          background: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(20px)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
          borderRadius: '20px',
        }}
      >
        <DialogHeader className="px-6 py-4 border-b" style={{ borderColor: 'rgba(200, 200, 200, 0.2)' }}>
          <DialogTitle className="text-lg font-semibold text-center text-gray-900">Start Live Stream</DialogTitle>
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-4 top-3 h-8 w-8 rounded-full hover:bg-gray-100 text-gray-600"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </Button>
        </DialogHeader>

        <div className="p-6 space-y-4">
          {isMobile && (
            <div 
              className="p-3 rounded-lg text-sm flex items-center gap-2"
              style={{
                background: 'rgba(59, 130, 246, 0.1)',
                border: '1px solid rgba(59, 130, 246, 0.2)',
                color: '#3b82f6',
              }}
            >
              <Smartphone className="w-4 h-4" />
              <span>Mobile device detected. Using back camera if available.</span>
            </div>
          )}

          {deviceError && (
            <div 
              className="p-3 rounded-lg text-sm"
              style={{
                background: deviceError.includes('required') 
                  ? 'rgba(239, 68, 68, 0.1)' 
                  : 'rgba(234, 179, 8, 0.1)',
                border: deviceError.includes('required')
                  ? '1px solid rgba(239, 68, 68, 0.2)'
                  : '1px solid rgba(234, 179, 8, 0.2)',
                color: deviceError.includes('required') ? '#ef4444' : '#eab308',
              }}
            >
              {deviceError}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="description" className="text-sm font-medium text-gray-700">Stream Description</Label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's your stream about?"
              className="w-full min-h-[70px] resize-vertical overflow-y-auto"
              onWheel={(e) => e.stopPropagation()}
              onTouchMove={(e) => e.stopPropagation()}
              style={{
                background: 'rgba(255, 255, 255, 0.6)',
                border: '1px solid rgba(200, 200, 200, 0.3)',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                borderRadius: '8px',
                padding: '8px 10px',
                fontSize: '13px',
                color: '#000',
                outline: 'none',
              }}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-gray-700">Stream Thumbnail</Label>
            {!thumbnailPreview ? (
              <div
                className={`relative transition-colors cursor-pointer ${
                  isDragging ? 'opacity-80' : ''
                }`}
                onDrop={onDrop}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                style={{
                  background: 'rgba(255, 255, 255, 0.6)',
                  border: '2px dashed rgba(200, 200, 200, 0.5)',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                  borderRadius: '8px',
                  padding: '12px',
                }}
              >
                <input
                  type="file"
                  id="thumbnail-upload"
                  accept="image/*"
                  onChange={(e) => e.target.files?.[0] && handleThumbnailChange(e.target.files[0])}
                  className="hidden"
                />
                <label
                  htmlFor="thumbnail-upload"
                  className="cursor-pointer flex flex-col items-center justify-center py-1"
                >
                  <Upload className="h-5 w-5 text-blue-500 mb-1" />
                  <span className="text-sm text-gray-600">Drop media here or click to upload</span>
                </label>
              </div>
            ) : (
              <div className="mt-4">
                <div className="relative">
                  <img
                    src={thumbnailPreview}
                    alt="Stream thumbnail"
                    className="w-full h-64 object-cover rounded-lg"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setThumbnail(null);
                      setThumbnailPreview(null);
                    }}
                    className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                    style={{
                      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
                    }}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Thumbnail Confirmation Dialog */}
          <Dialog open={showThumbnailConfirm} onOpenChange={setShowThumbnailConfirm}>
            <DialogContent 
              className="sm:max-w-[90vw] md:max-w-[800px] max-h-[90vh] overflow-y-auto border-0"
              style={{
                background: 'rgba(255, 255, 255, 0.95)',
                backdropFilter: 'blur(20px)',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
                borderRadius: '20px',
              }}
            >
              <DialogHeader className="px-6 py-4 border-b" style={{ borderColor: 'rgba(200, 200, 200, 0.2)' }}>
                <DialogTitle className="text-base font-semibold text-center text-gray-900">Confirm Thumbnail</DialogTitle>
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
              <div className="flex justify-end gap-2 p-4 border-t" style={{ borderColor: 'rgba(200, 200, 200, 0.2)' }}>
                <button
                  onClick={cancelThumbnail}
                  className="text-white font-medium transition-all duration-200 uppercase"
                  style={{
                    border: 'none',
                    backgroundImage: 'linear-gradient(30deg, #6b7280, #9ca3af)',
                    backgroundColor: 'transparent',
                    borderRadius: '15px',
                    fontSize: '11px',
                    padding: '0.4em 0.8em',
                    cursor: 'pointer',
                  }}
                >
                  CANCEL
                </button>
                <button
                  onClick={confirmThumbnail}
                  className="text-white font-medium transition-all duration-200 uppercase"
                  style={{
                    border: 'none',
                    backgroundImage: 'linear-gradient(30deg, #0400ff, #4ce3f7)',
                    backgroundColor: 'transparent',
                    borderRadius: '15px',
                    fontSize: '11px',
                    padding: '0.4em 0.8em',
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                  }}
                >
                  CONFIRM
                </button>
              </div>
            </DialogContent>
          </Dialog>

          <div className="space-y-2">
            <Label className="text-sm font-medium text-gray-700">Chat Settings</Label>
            <div className="flex items-center gap-2">
              <label className="flex items-center cursor-pointer scale-75">
                <input
                  id="allow-chat"
                  type="checkbox"
                  checked={chatEnabled}
                  onChange={(e) => setChatEnabled(e.target.checked)}
                  className="checkbox"
                  style={{ display: 'none' }}
                />
                <span className="slider"></span>
              </label>
              <Label htmlFor="allow-chat" className="text-sm text-gray-700">Allow Chat</Label>
            </div>
            {chatEnabled && (
              <div className="flex items-center gap-2 mt-1.5">
                <label className="flex items-center cursor-pointer scale-75">
                  <input
                    id="chat-visibility"
                    type="checkbox"
                    checked={chatVisibility === 'private'}
                    onChange={e => setChatVisibility(e.target.checked ? 'private' : 'public')}
                    className="checkbox"
                    style={{ display: 'none' }}
                  />
                  <span className="slider"></span>
                </label>
                <Label htmlFor="chat-visibility" className="text-sm text-gray-700 flex items-center gap-1">
                  <span>Private Chat</span>
                  <TooltipProvider delayDuration={0}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button 
                          type="button"
                          className="ml-0.5 cursor-help text-blue-500 hover:text-blue-600 transition-colors"
                          onClick={(e) => e.preventDefault()}
                        >
                          <Info className="w-3.5 h-3.5" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent 
                        side="right"
                        className="text-xs max-w-xs p-3"
                        style={{
                          background: 'rgba(255, 255, 255, 0.95)',
                          backdropFilter: 'blur(10px)',
                          border: '1px solid rgba(200, 200, 200, 0.3)',
                          color: '#000',
                          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                        }}
                      >
                        <div className="font-semibold mb-1">Private Chat Mode</div>
                        <div className="text-xs leading-relaxed">
                          <strong>Private (Checked):</strong> Only you and the person who sent a message can see it. Like DMs during the stream.<br/><br/>
                          <strong>Public (Unchecked):</strong> Everyone watching the stream can see all messages in the chat.
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </Label>
              </div>
            )}
          </div>

          {/* Device detection status */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-gray-700">Device Status</Label>
            <div className="flex flex-row gap-4 text-sm items-center">
              <span className="flex items-center gap-1.5 text-gray-700">
                Microphone
                {audioInputs.length > 0 ? (
                  <span className="text-green-500 font-bold">✔</span>
                ) : (
                  <span className="text-red-500 font-bold">✖</span>
                )}
              </span>
              <span className="flex items-center gap-1.5 text-gray-700">
                Camera
                {videoInputs.length > 0 ? (
                  <span className="text-green-500 font-bold">✔</span>
                ) : (
                  <span className="text-red-500 font-bold">✖</span>
                )}
              </span>
            </div>
          </div>

          <button
            className="w-full text-white font-medium transition-all duration-200 uppercase"
            onClick={handleStartStream}
            disabled={isStarting || !description.trim()}
            style={{
              border: 'none',
              backgroundColor: '#3b82f6',
              borderRadius: '15px',
              fontSize: '13px',
              padding: '0.6em 1em',
              cursor: (isStarting || !description.trim()) ? 'not-allowed' : 'pointer',
              opacity: (isStarting || !description.trim()) ? 0.5 : 1,
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            }}
          >
            {isStarting ? 'STARTING STREAM...' : 'GO LIVE'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
} 
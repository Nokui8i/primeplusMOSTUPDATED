import React from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Avatar, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import LiveChat from './LiveChat';
import { X, Camera } from 'lucide-react';

interface LiveStreamPopupProps {
  isOpen: boolean;
  onClose: () => void;
  videoSrc?: string;
  videoComponent?: React.ReactNode;
  avatarUrl: string;
  username: string;
  isLive: boolean;
  chatStreamId: string;
  onEndStream?: () => void;
  children?: React.ReactNode;
}

export default function LiveStreamPopup({
  isOpen,
  onClose,
  videoSrc,
  videoComponent,
  avatarUrl,
  username,
  isLive,
  chatStreamId,
  onEndStream,
  children,
}: LiveStreamPopupProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center"
        style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)' }}
      >
        <DialogContent
          className="relative w-[90vw] h-[90vh] max-w-5xl max-h-[90vh] p-0 bg-transparent shadow-2xl overflow-hidden flex flex-col justify-between md:rounded-2xl rounded-none"
        >
          {/* Video Background */}
          <div
            className="absolute inset-0 w-full h-full z-0"
            style={{ aspectRatio: '16/9' }}
          >
            {videoComponent ? (
              videoComponent
            ) : videoSrc ? (
              <video
                src={videoSrc}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
                style={{ aspectRatio: '16/9' }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-black">
                <Camera className="w-24 h-24 text-gray-700" />
              </div>
            )}
            <div className="absolute inset-0 bg-black/30" />
          </div>

          {/* Top Bar */}
          <div className="absolute top-0 left-0 w-full flex items-center justify-between px-4 md:px-8 py-4 z-10">
            <div className="flex items-center gap-4">
              <Avatar className="w-10 h-10 border-2 border-white">
                <AvatarImage src={avatarUrl} />
              </Avatar>
              <div className="flex flex-col">
                <span className="font-semibold text-white text-base">@{username}</span>
                {isLive && (
                  <span className="mt-1 inline-block h-5 px-3 bg-[#e53935] text-white text-xs font-bold rounded-full flex items-center gap-1" style={{ height: 20 }}>
                    <span className="w-2 h-2 bg-white rounded-full animate-pulse mr-1" />
                    LIVE
                  </span>
                )}
              </div>
            </div>
            <Button className="bg-black/40 hover:bg-black/60 text-white rounded-full p-2" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* End Stream Button (overlay) */}
          {onEndStream && (
            <Button
              className="absolute bottom-4 right-4 md:bottom-8 md:right-8 z-20 bg-red-600 hover:bg-red-700 text-white font-bold px-6 py-2 rounded-full shadow-lg"
              onClick={onEndStream}
            >
              End Stream
            </Button>
          )}

          {/* Chat Area (Bottom) */}
          <div className="absolute left-0 right-0 bottom-0 z-10 flex flex-col w-full px-0 pb-0">
            <div className="w-full max-h-[40vh] overflow-y-auto bg-black/40 px-2 md:px-6 pt-4 pb-2 rounded-t-2xl" style={{ minHeight: 120 }}>
              <LiveChat streamId={chatStreamId} hideControls />
            </div>
            {/* Input Bar (handled by LiveChat) */}
          </div>

          {/* Children (for overlays, controls, etc.) */}
          {children}
        </DialogContent>
      </div>
    </Dialog>
  );
} 
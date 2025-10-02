import React, { useState, useRef } from 'react';
import { X, Upload, Lock, Unlock, DollarSign, Image as ImageIcon, Video as VideoIcon, Plus, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogTitle, DialogDescription } from '@/components/ui/dialog';

interface MediaItem {
  file: File;
  preview: string;
  locked: boolean;
  price: string;
  type: 'image' | 'video';
}

interface BulkContentUploadProps {
  onSend: (data: { text: string; media: { file: File; locked: boolean; price?: string; type: 'image' | 'video' }[] }) => void;
  onCancel: () => void;
  uploading?: boolean;
  defaultMessage?: string;
  defaultMedia?: MediaItem[];
}

export function BulkContentUpload({ onSend, onCancel, uploading, defaultMessage = '', defaultMedia = [] }: BulkContentUploadProps) {
  const [text, setText] = useState(defaultMessage);
  const [media, setMedia] = useState<MediaItem[]>(defaultMedia);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [previewAsSubscriber, setPreviewAsSubscriber] = useState(false);

  const handleFiles = (files: FileList | File[]) => {
    const arr = Array.from(files);
    const newMedia: MediaItem[] = arr.map(file => ({
      file,
      preview: URL.createObjectURL(file),
      locked: false,
      price: '',
      type: file.type.startsWith('image') ? 'image' : 'video',
    }));
    setMedia(prev => [...prev, ...newMedia]);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) handleFiles(e.target.files);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files) handleFiles(e.dataTransfer.files);
  };

  const handleRemove = (idx: number) => {
    setMedia(prev => {
      URL.revokeObjectURL(prev[idx].preview);
      return prev.filter((_, i) => i !== idx);
    });
  };

  const handleLockToggle = (idx: number, locked: boolean) => {
    setMedia(prev => prev.map((m, i) => i === idx ? { ...m, locked, price: locked ? m.price : '' } : m));
  };

  const handlePriceChange = (idx: number, price: string) => {
    setMedia(prev => prev.map((m, i) => i === idx ? { ...m, price } : m));
  };

  const validate = () => {
    for (const m of media) {
      if (m.locked) {
        const p = parseFloat(m.price);
        if (isNaN(p) || p < 0.99) {
          setError('Locked media must have a price of at least $0.99');
          return false;
        }
      }
    }
    setError(null);
    return true;
  };

  const handleSend = () => {
    if (!validate()) return;
    onSend({ text, media });
  };

  return (
    <div className="w-full max-w-lg p-0 bg-transparent border-0 shadow-none">
      <div className="mb-4">
        <DialogTitle asChild>
          <h3 className="text-lg font-bold">Send Content to Subscribers</h3>
        </DialogTitle>
        <DialogDescription>
          Compose a message and attach media to send to your subscribers. You can set media as free or paid, and preview how it will appear to subscribers.
        </DialogDescription>
      </div>
      <textarea
        className="w-full border rounded-lg p-2 mb-4 text-sm min-h-[60px] focus:ring-2 focus:ring-blue-200"
        placeholder="Write your message..."
        value={text}
        onChange={e => setText(e.target.value)}
        disabled={uploading}
      />
      {/* Drag-and-drop area for single upload */}
      {media.length === 0 && (
        <div
          className="border-2 border-dashed rounded-lg min-h-[120px] p-4 mb-4 flex flex-col items-center justify-center cursor-pointer bg-gray-50 hover:bg-blue-50 transition"
          onClick={() => fileInputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={e => e.preventDefault()}
        >
          <Upload className="h-8 w-8 text-blue-400 mb-2" />
          <div className="text-sm text-gray-500">Click or drag an image/video here</div>
          <input
            type="file"
            accept="image/*,video/*"
            ref={fileInputRef}
            className="hidden"
            onChange={e => {
              if (e.target.files && e.target.files.length > 0) {
                handleFiles([e.target.files[0]]);
              }
            }}
            disabled={uploading}
          />
        </div>
      )}
      {/* Single media card */}
      {media.length === 1 && (
        <div className="w-full max-w-[500px] flex flex-col items-center mx-auto">
          <div className="flex items-center justify-between w-full mb-2">
            <span className="text-xs text-gray-500 font-medium">Media Preview</span>
            <label className="flex items-center gap-1 cursor-pointer select-none">
              <input type="checkbox" checked={previewAsSubscriber} onChange={e => setPreviewAsSubscriber(e.target.checked)} className="accent-blue-500" />
              <span className="text-xs text-gray-500">Preview as subscriber</span>
            </label>
          </div>
          <div className="relative border rounded-xl bg-white shadow-lg w-full flex flex-col items-center p-4 h-72 justify-center mx-auto">
            <button className="absolute top-2 right-2 text-gray-400 hover:text-red-500 z-20" onClick={e => { e.stopPropagation(); handleRemove(0); }}><X className="h-4 w-4" /></button>
            {previewAsSubscriber && media[0].locked ? (
              <div className="relative w-full h-full flex flex-col items-center justify-center">
                <div className="absolute inset-0 bg-gray-400/60 rounded-md flex flex-col items-center justify-center z-10">
                  <Lock className="w-8 h-8 text-[#6437ff] mb-2" />
                  <span className="text-xs text-gray-800 font-semibold mb-1">Locked. Unlock for ${parseFloat(media[0].price || '0').toFixed(2)}</span>
                  <button className="profile-btn unlock">Unlock</button>
                </div>
                {media[0].type === 'image' ? (
                  <img src={media[0].preview} alt="locked preview" className="w-full max-w-full max-h-60 object-contain rounded-md mx-auto opacity-40 blur-[2px]" style={{ background: '#f8f8fa', display: 'block' }} />
                ) : (
                  <video src={media[0].preview} className="w-full max-w-full max-h-60 object-contain rounded-md mx-auto opacity-40 blur-[2px]" controls={false} style={{ background: '#f8f8fa', display: 'block' }} />
                )}
              </div>
            ) : media[0].type === 'image' ? (
              <img src={media[0].preview} alt="preview" className="w-full max-w-full max-h-60 object-contain rounded-md mx-auto" style={{ background: '#f8f8fa', display: 'block' }} onClick={() => { setViewerOpen(true); setViewerIndex(0); }} />
            ) : (
              <video src={media[0].preview} className="w-full max-w-full max-h-60 object-contain rounded-md mx-auto" controls style={{ background: '#f8f8fa', display: 'block' }} onClick={() => { setViewerOpen(true); setViewerIndex(0); }} />
            )}
          </div>
          <div className="flex items-center gap-3 w-full justify-center mt-3 mb-1">
            <Button
              type="button"
              size="sm"
              onClick={() => handleLockToggle(0, false)}
              className={`rounded-full px-2 py-0.5 text-xs h-7 min-h-0 font-semibold shadow-none border-none ${!media[0].locked ? 'bg-[#0a1121] text-white' : 'bg-gray-100 text-gray-500'}`}
            >
              Free
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => handleLockToggle(0, true)}
              className={`rounded-full px-2 py-0.5 text-xs h-7 min-h-0 font-semibold shadow-none border-none ${media[0].locked ? 'bg-[#0a1121] text-white' : 'bg-gray-100 text-gray-500'}`}
            >
              Paid
              <span className="ml-1" title="Paid: Subscribers must pay to unlock this media."><Info className="inline h-3 w-3 text-gray-400" /></span>
            </Button>
            {media[0].locked && (
              <div className="flex items-center ml-2 gap-1">
                <DollarSign className="h-4 w-4 text-gray-400" />
                <Input
                  type="number"
                  min="0.99"
                  step="0.01"
                  className="w-16 text-xs px-1 py-0.5 border-gray-300"
                  value={media[0].price}
                  onChange={e => handlePriceChange(0, e.target.value)}
                  placeholder="$"
                  disabled={uploading}
                />
              </div>
            )}
          </div>
          <div className="w-full text-center mt-1 mb-2">
            {media[0].locked ? (
              <span className="text-xs text-pink-500 font-medium">This media will be locked for ${parseFloat(media[0].price || '0').toFixed(2)}. Subscribers must pay to unlock.</span>
            ) : (
              <span className="text-xs text-green-600 font-medium">This media will be free for all subscribers.</span>
            )}
          </div>
        </div>
      )}
      {/* Photo viewer modal */}
      {viewerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80" onClick={() => setViewerOpen(false)}>
          <div className="relative max-w-2xl w-full flex flex-col items-center" onClick={e => e.stopPropagation()}>
            <button className="absolute top-4 right-4 text-white bg-black/50 rounded-full p-2 z-10" onClick={() => setViewerOpen(false)}><X className="h-6 w-6" /></button>
            {media[viewerIndex].type === 'image' ? (
              <img src={media[viewerIndex].preview} alt="full" className="max-w-full max-h-[80vh] rounded shadow-lg" />
            ) : (
              <video src={media[viewerIndex].preview} className="max-w-full max-h-[80vh] rounded shadow-lg" controls autoPlay />
            )}
            <div className="flex justify-between w-full mt-4">
              <button
                className="text-white bg-black/40 rounded-full p-2 disabled:opacity-30"
                onClick={() => setViewerIndex(i => Math.max(0, i - 1))}
                disabled={viewerIndex === 0}
              >
                &#8592;
              </button>
              <button
                className="text-white bg-black/40 rounded-full p-2 disabled:opacity-30"
                onClick={() => setViewerIndex(i => Math.min(media.length - 1, i + 1))}
                disabled={viewerIndex === media.length - 1}
              >
                &#8594;
              </button>
            </div>
            <div className="text-white text-xs mt-2">{viewerIndex + 1} / {media.length}</div>
          </div>
        </div>
      )}
      {error && <div className="text-red-500 text-xs mb-2">{error}</div>}
      <div className="flex justify-end gap-2 mt-2">
        <Button
          variant="outline"
          size="sm"
          className="bg-white text-black border border-gray-200 hover:bg-gray-100 shadow-none"
          onClick={onCancel}
          disabled={uploading}
        >
          Cancel
        </Button>
        <Button size="sm" onClick={handleSend} disabled={uploading || (media.length === 0 && !text.trim())}>
          {uploading ? 'Sending...' : 'Send'}
        </Button>
      </div>
    </div>
  );
} 
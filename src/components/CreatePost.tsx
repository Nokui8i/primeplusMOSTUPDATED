import { useState, useRef, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'react-hot-toast';
import { db } from '@/lib/firebase/config';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { uploadMedia } from '@/lib/firebase/db';
import { PostType } from '@/lib/types/post';
import { FiImage, FiVideo, FiBox, FiGlobe, FiLock, FiUnlock, FiDollarSign, FiLoader, FiSend } from 'react-icons/fi';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useDropzone } from 'react-dropzone';
import Cropper, { ReactCropperElement } from 'react-cropper';
import 'cropperjs/dist/cropper.css';

interface CreatePostProps {
  onPostCreated?: () => void;
}

export function CreatePost({ onPostCreated }: CreatePostProps) {
  const { user } = useAuth();
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [contentType, setContentType] = useState<PostType>('text');
  const [visibility, setVisibility] = useState<'public' | 'subscribers' | 'paid'>('public');
  const [isPaid, setIsPaid] = useState(false);
  const [price, setPrice] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [selectedPreviewIndex, setSelectedPreviewIndex] = useState(0);
  const [isCropping, setIsCropping] = useState(false);
  const [cropperImage, setCropperImage] = useState<string | null>(null);
  const cropperRef = useRef<ReactCropperElement>(null);
  const [showWatermark, setShowWatermark] = useState(true);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const files = acceptedFiles.filter(file => {
      const isValidType = file.type.startsWith('image/') || 
                         file.type.startsWith('video/') ||
                         file.type.includes('vr') ||
                         file.type.includes('360');
      
      if (!isValidType) {
        toast.error(`${file.name} is not a supported file type`);
        return false;
      }

      // MOV files will be automatically converted, so we allow them
      // No need to block MOV files anymore

      const maxSize = 10 * 1024 * 1024 * 1024; // 10GB for all files
      if (file.size > maxSize) {
        toast.error(`${file.name} is too large (max 10GB)`);
        return false;
      }

      return true;
    });

    if (files.length > 0) {
      const file = files[0];
      if (file.type.startsWith('image/')) {
        setCropperImage(URL.createObjectURL(file));
        setIsCropping(true);
      } else {
        // Create previews only for non-VR files
        const newPreviews = files.map(file => {
          // Don't create previews for VR files as they can't be properly displayed
          if (file.type.includes('vr') || file.type.includes('360')) {
            return null; // No preview for VR files
          }
          return URL.createObjectURL(file);
        });
        setSelectedFiles(prev => [...prev, ...files]);
        setPreviewUrls(prev => [...prev, ...newPreviews.filter(url => url !== null)]);
      }

      if (file.type.startsWith('image/')) setContentType('image');
      else if (file.type.startsWith('video/')) setContentType('video');
      else if (file.type.includes('vr')) setContentType('vr');
      else if (file.type.includes('360') && file.type.startsWith('image/')) setContentType('image360');
      else if (file.type.includes('360') && file.type.startsWith('video/')) setContentType('video360');
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.gif'],
      'video/*': ['.mp4', '.avi', '.mov', '.mkv', '.webm'], // Added .mov back
      'application/vr': ['.vr'],
      'application/360': ['.360']
    },
    maxFiles: 1
  });

  const handleCropComplete = () => {
    if (cropperRef.current?.cropper) {
      const cropper = cropperRef.current.cropper;
      cropper.getCroppedCanvas().toBlob((blob: Blob | null) => {
        if (blob) {
          const file = new File([blob], 'cropped-image.png', { type: 'image/png' });
          setSelectedFiles(prev => [...prev, file]);
          setPreviewUrls(prev => [...prev, URL.createObjectURL(blob)]);
        }
        setIsCropping(false);
        setCropperImage(null);
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error('Please sign in to create a post');
      return;
    }

    if (!content.trim() && selectedFiles.length === 0) {
      toast.error('Please add some content or media');
      return;
    }

    if (isPaid && (!price || parseFloat(price) < 0.99)) {
      toast.error('Paid content must have a price of at least $0.99');
      return;
    }

    setIsSubmitting(true);

    try {
      const mediaUrls = await Promise.all(
        selectedFiles.map(file => uploadMedia(file, `posts/${Date.now()}_${file.name}`, (progress) => {
          // Handle upload progress if needed
          console.log(`Upload progress: ${progress}%`);
        }))
      );

      const postData = {
        content: content.trim(),
        mediaUrls,
        type: contentType,
        authorId: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        likes: 0,
        comments: 0,
        shares: 0,
        visibility,
        isPaid,
        price: isPaid ? parseFloat(price) : null,
        status: 'active',
        metadata: {
          fileCount: selectedFiles.length,
          fileTypes: selectedFiles.map(f => f.type),
          fileSizes: selectedFiles.map(f => f.size)
        },
        showWatermark,
      };

      await addDoc(collection(db, 'posts'), postData);
      
      // Reset form
      setContent('');
      setSelectedFiles([]);
      setPreviewUrls([]);
      setContentType('text');
      setVisibility('public');
      setIsPaid(false);
      setPrice('');

      toast.success('Post created successfully!');
      onPostCreated?.();
    } catch (error) {
      console.error('Error creating post:', error);
      toast.error('Failed to create post');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveMedia = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    setPreviewUrls(prev => {
      URL.revokeObjectURL(prev[index]);
      return prev.filter((_, i) => i !== index);
    });
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 mb-8 transform transition-all hover:shadow-xl border border-[#EEEEEE]">
      <form onSubmit={handleSubmit}>
        <Textarea
          placeholder="Share your thoughts..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="w-full p-4 border border-[#E0E0E0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF4081] resize-none bg-[#FAFAFA] text-[#1A1A1A] placeholder-[#999999]"
          rows={3}
        />

        <div className="mt-4 space-y-4">
          {/* Media Upload Area */}
          {selectedFiles.length === 0 && (
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-xl p-8 transition-all duration-200 cursor-pointer ${
                isDragActive 
                  ? 'border-[#FF4081] bg-[#FF4081]/10' 
                  : 'border-[#E0E0E0] hover:border-[#FF4081]'
              }`}
            >
              <input {...getInputProps()} />
              <div className="flex flex-col items-center justify-center gap-2">
                <FiImage className="w-8 h-8 text-[#666666]" />
                <p className="text-sm text-[#666666]">
                  {isDragActive ? 'Drop your media here' : 'Drag & drop or click to upload'}
                </p>
                <p className="text-xs text-[#999999]">
                  Supports images, videos, VR, and 360° content
                </p>
              </div>
            </div>
          )}

          {/* Media Preview */}
          {selectedFiles.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {selectedFiles.map((file, index) => {
                const url = previewUrls[index];
                const isVRFile = file.type.includes('vr') || file.type.includes('360');
                
                return (
                  <div key={index} className="relative group">
                    {isVRFile ? (
                      // VR file placeholder - no preview
                      <div className="w-full h-32 bg-gradient-to-br from-purple-500 to-blue-600 rounded-lg flex items-center justify-center text-white font-medium">
                        <div className="text-center">
                          <div className="text-2xl mb-1">🥽</div>
                          <div className="text-xs">VR File</div>
                          <div className="text-xs opacity-75">{file.name}</div>
                        </div>
                      </div>
                    ) : url ? (
                      // Regular image/video preview
                      file.type.startsWith('image/') ? (
                        <img
                          src={url}
                          alt={`Preview ${index + 1}`}
                          className="w-full h-32 object-cover rounded-lg cursor-pointer"
                          onClick={() => {
                            setSelectedPreviewIndex(index);
                            setShowPreview(true);
                          }}
                        />
                      ) : (
                        <video
                          src={url}
                          className="w-full h-32 object-cover rounded-lg cursor-pointer"
                          onClick={() => {
                            setSelectedPreviewIndex(index);
                            setShowPreview(true);
                          }}
                        />
                      )
                    ) : null}
                    <button
                      type="button"
                      onClick={() => handleRemoveMedia(index)}
                      className="absolute top-2 right-2 bg-black/50 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      ×
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Visibility and Pricing Options */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Select value={visibility} onValueChange={(value: 'public' | 'subscribers' | 'paid') => {
                setVisibility(value);
                setIsPaid(value === 'paid');
              }}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="public">Public</SelectItem>
                  <SelectItem value="subscribers">Subscribers</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                </SelectContent>
              </Select>

              {visibility === 'paid' && (
                <div className="flex items-center space-x-2">
                  <FiDollarSign className="text-[#666666]" />
                  <Input
                    type="number"
                    min="0.99"
                    step="0.01"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="0.99"
                    className="w-24"
                  />
                </div>
              )}
            </div>

            <Button
              type="submit"
              disabled={isSubmitting || (!content.trim() && selectedFiles.length === 0)}
              className="px-6 py-2.5 bg-gradient-to-r from-[#FF80AB] via-[#FF4081] to-[#E91E63] text-white rounded-xl hover:from-[#FF4081] hover:to-[#C2185B] focus:outline-none focus:ring-2 focus:ring-[#E91E63] focus:ring-offset-2 disabled:opacity-50 transition-all transform hover:scale-105 flex items-center space-x-2 font-medium shadow-lg hover:shadow-xl"
            >
              {isSubmitting ? (
                <FiLoader className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <FiSend className="w-5 h-5" />
                  <span>Share</span>
                </>
              )}
            </Button>
          </div>

          {/* Watermark Switch */}
          <div className="flex items-center gap-2 mt-2">
            <Switch id="show-watermark" checked={showWatermark} onCheckedChange={setShowWatermark} size="sm" className="border border-gray-500/40 focus:ring-2 focus:ring-brand-pink-main shadow-sm" />
            <Label htmlFor="show-watermark" className="text-xs font-normal text-gray-300 dark:text-gray-400 min-w-0 ml-2">Show Watermark on Media</Label>
          </div>
        </div>
      </form>

      {/* Image Cropping Modal */}
      <Dialog open={isCropping} onOpenChange={setIsCropping}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Crop Image</DialogTitle>
            <DialogDescription>
              Adjust the crop area to your liking
            </DialogDescription>
          </DialogHeader>
          <div className="relative h-[60vh]">
            {cropperImage && (
              <Cropper
                ref={cropperRef}
                src={cropperImage}
                style={{ height: '100%', width: '100%' }}
                aspectRatio={16 / 9}
                guides={true}
                autoCropArea={1}
                background={false}
                viewMode={1}
              />
            )}
          </div>
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setIsCropping(false)}>
              Cancel
            </Button>
            <Button onClick={handleCropComplete}>
              Apply Crop
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Media Preview Modal */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Media Preview</DialogTitle>
            <DialogDescription>
              {selectedFiles[selectedPreviewIndex]?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="relative">
            {selectedFiles[selectedPreviewIndex]?.type.startsWith('image/') ? (
              <img
                src={previewUrls[selectedPreviewIndex]}
                alt="Preview"
                className="w-full max-h-[80vh] object-contain"
              />
            ) : (
              <video
                src={previewUrls[selectedPreviewIndex]}
                controls
                className="w-full max-h-[80vh]"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
} 
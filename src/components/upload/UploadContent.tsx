import React, { useState, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'react-hot-toast';
import { RefreshCw } from 'lucide-react';
import { db } from '@/lib/firebase/config';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { uploadMedia } from '@/lib/firebase/db';
import { convertVideoFile, needsVideoConversion } from '@/lib/videoConverter';
import HotspotEditor from '@/components/creator/HotspotEditor';
import { Hotspot } from '@/types/vr';
import { PostType } from '@/lib/types/post';
import { FiImage, FiVideo, FiBox, FiGlobe, FiLock, FiUnlock, FiDollarSign } from 'react-icons/fi';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

// 🎨 Progress Bar CSS
const progressBarStyles = `
  .conversion-progress-bar {
    width: 100%;
    height: 12px;
    background: #F9F9F9;
    border-radius: 10px;
    border: 1px solid #006DFE;
    position: relative;
    overflow: hidden;
    margin: 8px 0;
  }

  .conversion-progress-bar::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    height: 100%;
    border-radius: 5px;
    background: repeating-linear-gradient(45deg, #0031F2 0 30px, #006DFE 0 40px) right/200% 100%;
    animation: lightEffect 1s infinite linear;
    transition: width 0.3s ease;
    width: var(--progress, 0%);
  }

  @keyframes lightEffect {
    0%, 20%, 40%, 60%, 80%, 100% {
      background: repeating-linear-gradient(45deg, #0031F2 0 30px, #006DFE 0 40px) right/200% 100%;
    }
    10%, 30%, 50%, 70%, 90% {
      background: repeating-linear-gradient(45deg, #0031F2 0 30px, #006DFE 0 40px, rgba(255, 255, 255, 0.3) 0 40px) right/200% 100%;
    }
  }
`;

interface UploadContentProps {
  onUploadComplete?: () => void;
  defaultVisibility?: 'public' | 'subscribers' | 'paid';
  defaultPlanId?: string;
}

export function UploadContent({ onUploadComplete, defaultVisibility = 'public', defaultPlanId }: UploadContentProps) {
  const { user } = useAuth();
  
  // 🎨 Inject CSS styles
  React.useEffect(() => {
    const style = document.createElement('style');
    style.textContent = progressBarStyles;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);
  const [content, setContent] = useState('');
  const [title, setTitle] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [contentType, setContentType] = useState<PostType>('text');
  const [visibility, setVisibility] = useState(defaultVisibility);
  const [isPaid, setIsPaid] = useState(false);
  const [price, setPrice] = useState('');
  const [selectedPlanId, setSelectedPlanId] = useState(defaultPlanId || '');
  const [showPreview, setShowPreview] = useState(false);
  const [selectedPreviewIndex, setSelectedPreviewIndex] = useState(0);
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({});
  const [uploadStatus, setUploadStatus] = useState<string>('');
  const [showWatermark, setShowWatermark] = useState(true);
  const [convertingFiles, setConvertingFiles] = useState<{ [key: string]: boolean }>({});
  const [conversionProgress, setConversionProgress] = useState<{ [key: string]: number }>({});
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [showHotspotEditor, setShowHotspotEditor] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 🎨 Progress Bar Component
  const ConversionProgressBar = ({ fileName, progress, isConverting }: { fileName: string; progress: number; isConverting: boolean }) => {
    if (!isConverting) return null;
    
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center">
            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-2" />
            <span className="text-sm font-medium text-blue-700">Converting {fileName}...</span>
          </div>
          <span className="text-sm font-bold text-blue-600">{Math.round(progress)}%</span>
        </div>
        <div 
          className="conversion-progress-bar"
          style={{ '--progress': `${progress}%` } as React.CSSProperties}
        >
          <div 
            className="conversion-progress-bar::before"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    );
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Validate file types and sizes
    const validFiles = files.filter(file => {
      const isValidType = file.type.startsWith('image/') || 
                         file.type.startsWith('video/') ||
                         file.type.includes('vr') ||
                         file.type.includes('360');
      
      if (!isValidType) {
        toast.error(`${file.name} is not a supported file type`);
        return false;
      }

      const maxSize = 10 * 1024 * 1024 * 1024; // 10GB for all files
      if (file.size > maxSize) {
        toast.error(`${file.name} is too large (max 10GB)`);
        return false;
      }

      return true;
    });

    if (validFiles.length === 0) return;

    // Process each file immediately
    for (let i = 0; i < validFiles.length; i++) {
      const file = validFiles[i];
      const fileKey = `${file.name}_${Date.now()}_${i}`;
      
      
      // Check if file needs conversion
      const needsConversion = needsVideoConversion(file);
      
      if (needsConversion) {
        // Show conversion UI
        setConvertingFiles(prev => ({ ...prev, [fileKey]: true }));
        setConversionProgress(prev => ({ ...prev, [fileKey]: 0 }));
        
        try {
          const convertedFile = await convertVideoFile(file, (progress) => {
            setConversionProgress(prev => ({ ...prev, [fileKey]: progress }));
          });
          
          // Add converted file to selected files
          setSelectedFiles(prev => [...prev, convertedFile]);
          
          // Create preview for converted file (as regular video)
          const previewUrl = URL.createObjectURL(convertedFile);
          setPreviewUrls(prev => [...prev, previewUrl]);
          
          toast.success(`${file.name} converted successfully!`);
        } catch (conversionError) {
          console.error('Conversion failed:', conversionError);
          toast.error(`Failed to convert ${file.name}: ${conversionError}`);
          
          // Add original file as fallback
          setSelectedFiles(prev => [...prev, file]);
          const previewUrl = URL.createObjectURL(file);
          setPreviewUrls(prev => [...prev, previewUrl]);
        } finally {
          setConvertingFiles(prev => ({ ...prev, [fileKey]: false }));
          setConversionProgress(prev => ({ ...prev, [fileKey]: 0 }));
        }
      } else {
        // No conversion needed, add file directly
        setSelectedFiles(prev => [...prev, file]);
        
        // Create preview for all files (including VR files)
        const previewUrl = URL.createObjectURL(file);
        setPreviewUrls(prev => [...prev, previewUrl]);
      }
    }

    // Set content type based on first file
    if (validFiles.length > 0) {
      const file = validFiles[0];
      if (file.type.startsWith('image/')) setContentType('image');
      else if (file.type.startsWith('video/')) setContentType('video');
      else if (file.type.includes('vr')) setContentType('vr');
      else if (file.type.includes('360') && file.type.startsWith('image/')) setContentType('image360');
      else if (file.type.includes('360') && file.type.startsWith('video/')) setContentType('video360');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error('Please sign in to create content');
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
      setUploadStatus('Processing files...');
      const mediaUrls: string[] = [];
      
      // Upload files (conversion already done in handleFileChange)
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        const fileKey = `${file.name}_${i}`;
        
        setUploadStatus(`Uploading ${file.name} (${i + 1}/${selectedFiles.length})...`);
        
        try {
          // Upload the file (already converted if needed)
          const mediaUrl = await uploadMedia(file, `content/${file.type.startsWith('image/') ? 'images' : 'videos'}/${user.uid}/${Date.now()}_${file.name}`, (progress) => {
            setUploadProgress(prev => ({
              ...prev,
              [fileKey]: progress
            }));
          });
          
          mediaUrls.push(mediaUrl);
        } catch (error) {
          console.error(`❌ Failed to upload ${file.name}:`, error);
          toast.error(`Failed to upload ${file.name}. Please try again.`);
          throw error;
        }
      }

      const postData = {
        title: title.trim(),
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
        planId: selectedPlanId || null,
        status: 'active',
        metadata: {
          fileCount: selectedFiles.length,
          fileTypes: selectedFiles.map(f => f.type),
          fileSizes: selectedFiles.map(f => f.size)
        },
        hotspots: hotspots.length > 0 ? hotspots : undefined,
        showWatermark,
      };

      await addDoc(collection(db, 'posts'), postData);
      
      // Reset form
      setContent('');
      setTitle('');
      setSelectedFiles([]);
      setPreviewUrls([]);
      setContentType('text');
      setVisibility('public');
      setIsPaid(false);
      setPrice('');
      setSelectedPlanId('');
      setUploadProgress({});
      setUploadStatus('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      toast.success('Content uploaded successfully!');
      onUploadComplete?.();
    } catch (error) {
      console.error('Error uploading content:', error);
      toast.error('Failed to upload content');
    } finally {
      setIsSubmitting(false);
      setUploadStatus('');
    }
  };

  const handleRemoveMedia = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    setPreviewUrls(prev => {
      // Only revoke URL if it exists (not null for VR files)
      if (prev[index]) {
        URL.revokeObjectURL(prev[index]);
      }
      return prev.filter((_, i) => i !== index);
    });
  };

  const getContentTypeIcon = (type: PostType) => {
    switch (type) {
      case 'image':
        return <FiImage className="h-5 w-5" />;
      case 'video':
        return <FiVideo className="h-5 w-5" />;
      case 'vr':
        return <FiBox className="h-5 w-5" />;
      case 'image360':
      case 'video360':
        return <FiGlobe className="h-5 w-5" />;
      default:
        return null;
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-4">
          <div>
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter a title for your content"
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="content">Content</Label>
            <Textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Describe your content..."
              className="mt-1 resize-none"
              rows={4}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Visibility</Label>
              <Select value={visibility} onValueChange={(value: 'public' | 'subscribers' | 'paid') => setVisibility(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="public">Public</SelectItem>
                  <SelectItem value="subscribers">Subscribers Only</SelectItem>
                  <SelectItem value="paid">Paid Content</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {visibility === 'paid' && (
              <div>
                <Label>Price ($)</Label>
                <Input
                  type="number"
                  min="0.99"
                  step="0.01"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="0.99"
                  className="mt-1"
                />
              </div>
            )}
          </div>

          <div className="space-y-4">
            <Label>Media Upload</Label>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/*,video/*,application/vr,application/360,.mov,.mkv,.webm"
                  multiple
                  className="hidden"
                  id="media-upload"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center space-x-2"
                >
                  <FiImage className="h-5 w-5" />
                  <span>Upload Media</span>
                </Button>
              </div>
              <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded text-xs text-blue-700 dark:text-blue-300">
                <strong>Note:</strong> MOV files will be automatically converted to MP4 during upload for optimal VR compatibility.
              </div>
            </div>

            {/* Watermark Switch */}
            <div className="flex items-center space-x-3 mt-2">
              <Switch id="show-watermark" checked={showWatermark} onCheckedChange={setShowWatermark} />
              <Label htmlFor="show-watermark">Show Watermark on Media</Label>
            </div>

            {/* Upload Progress */}
            {isSubmitting && uploadStatus && (
              <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <div className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
                  {uploadStatus}
                </div>
                {Object.keys(uploadProgress).map((fileKey) => (
                  <div key={fileKey} className="mb-2">
                    <div className="flex justify-between text-xs text-blue-700 dark:text-blue-300 mb-1">
                      <span>{fileKey.split('_')[0]}</span>
                      <span>{uploadProgress[fileKey]}%</span>
                    </div>
                    <div className="w-full bg-blue-200 dark:bg-blue-800 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${uploadProgress[fileKey]}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Conversion Progress */}
            {Object.keys(convertingFiles).length > 0 && (
              <div className="mt-4 p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                <div className="text-sm font-medium text-orange-900 dark:text-orange-100 mb-2">
                  Converting video files...
                </div>
                {Object.entries(convertingFiles).map(([fileId, isConverting]) => {
                  if (!isConverting) return null;
                  const progress = conversionProgress[fileId] || 0;
                  const fileName = fileId.split('-').slice(0, -1).join('-');
                  
                  return (
                    <div key={fileId} className="mb-2">
                      <div className="flex items-center justify-between text-xs text-orange-700 dark:text-orange-300 mb-1">
                        <span className="flex items-center gap-2">
                          <RefreshCw className="h-3 w-3 animate-spin" />
                          {fileName}
                        </span>
                        <span>{Math.round(progress)}%</span>
                      </div>
                      <div className="w-full bg-orange-200 dark:bg-orange-800 rounded-full h-2">
                        <div
                          className="bg-orange-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* 🎨 Conversion Progress Bars */}
            {Object.keys(convertingFiles).map((fileKey) => {
              const isConverting = convertingFiles[fileKey];
              const progress = conversionProgress[fileKey] || 0;
              const fileName = fileKey.split('_')[0]; // Extract original filename
              
              return (
                <ConversionProgressBar
                  key={fileKey}
                  fileName={fileName}
                  progress={progress}
                  isConverting={isConverting}
                />
              );
            })}

            {selectedFiles.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
                {selectedFiles.map((file, index) => {
                  const url = previewUrls[index];
                  const isVRFile = file.type.includes('vr') || file.type.includes('360');
                  
                  return (
                    <div key={index} className="relative group">
                      {url ? (
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
                      ) : (
                        // Fallback for VR files without preview
                        <div className="w-full h-32 bg-gradient-to-br from-purple-500 to-blue-600 rounded-lg flex items-center justify-center text-white font-medium relative">
                          <div className="text-center">
                            <div className="text-2xl mb-1">🥽</div>
                            <div className="text-xs">VR File</div>
                            <div className="text-xs opacity-75">{file.name}</div>
                            {file.name.toLowerCase().endsWith('.mov') && (
                              <div className="text-xs text-yellow-300 mt-1">🔄 Will convert to MP4</div>
                            )}
                          </div>
                          
                          {/* Hotspot Editor Button for VR Content */}
                          {(contentType === 'image360' || contentType === 'video360') && (
                            <button
                              type="button"
                              onClick={() => setShowHotspotEditor(true)}
                              className="absolute top-2 left-2 bg-blue-600 hover:bg-blue-700 text-white text-xs px-2 py-1 rounded-full flex items-center space-x-1 transition-colors"
                            >
                              <span>🎯</span>
                              <span>Add Hotspots</span>
                            </button>
                          )}
                        </div>
                      )}
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
          </div>
        </div>

        <div className="flex justify-end space-x-4">
          <Button
            type="submit"
            disabled={isSubmitting || Object.keys(convertingFiles).length > 0 || (!content.trim() && selectedFiles.length === 0)}
            className="bg-gradient-to-r from-pink-500 to-purple-500 text-white hover:from-pink-600 hover:to-purple-600"
          >
            {isSubmitting ? (
              <div className="flex items-center">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                Uploading...
              </div>
            ) : Object.keys(convertingFiles).length > 0 ? (
              <div className="flex items-center">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                Converting...
              </div>
            ) : (
              <div className="flex items-center">
                {getContentTypeIcon(contentType)}
                <span className="ml-2">Upload Content</span>
              </div>
            )}
          </Button>
        </div>
      </form>

      {/* Preview Modal */}
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

      {/* Hotspot Editor Modal */}
      {showHotspotEditor && selectedFiles.length > 0 && (
        <HotspotEditor
          src={previewUrls[0] || URL.createObjectURL(selectedFiles[0])}
          type={contentType as 'image360' | 'video360'}
          hotspots={hotspots}
          onHotspotsChange={setHotspots}
          onClose={() => setShowHotspotEditor(false)}
        />
      )}
    </div>
  );
} 
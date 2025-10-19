'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { X, Upload, Smile, ChevronDown } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { collection, addDoc, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { uploadMedia } from '@/lib/aws/upload';
import { ContentWatermark } from '@/components/media/ContentWatermark';
import VideoThumbnailUpload from '@/components/creator/VideoThumbnailUpload';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface ContentUploadProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadComplete?: () => void;
  userId: string;
}

export default function ContentUpload({ isOpen, onClose, onUploadComplete, userId }: ContentUploadProps) {
  const { user } = useAuth();
  const [content, setContent] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [isUploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [showWatermark, setShowWatermark] = useState(true);
  const [accessLevel, setAccessLevel] = useState<'free' | 'free_subscriber' | 'paid_subscriber'>('free');
  const [postType, setPostType] = useState<'text' | 'image' | 'video' | 'image360' | 'video360'>('text');
  const [step, setStep] = useState(1);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [isVerified, setIsVerified] = useState(false);
  const [isCreatorRole, setIsCreatorRole] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Load user profile and username
  useEffect(() => {
    const loadUserProfile = async () => {
      if (user?.uid) {
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            setUserProfile(userData);
            if (userData?.username) {
              setUsername(userData.username);
            }
            
            // Check if user is a verified creator (for paid content monetization)
            // Only creators can monetize their content
            const hasCreatorRole = userData.role === 'creator' || userData.role === 'admin' || userData.role === 'superadmin' || userData.role === 'owner';
            setIsCreatorRole(hasCreatorRole);
            
            if (hasCreatorRole) {
              // Admin, superadmin, and owner roles are automatically verified
              if (userData.role === 'admin' || userData.role === 'superadmin' || userData.role === 'owner') {
                setIsVerified(true);
              } else {
                // For regular creators, check BOTH old method (isVerified field) and new method (verificationData collection)
                // This ensures backward compatibility
                let verified = false;
                
                // Check old method first (for existing verified creators)
                if (userData.isVerified === true) {
                  verified = true;
                } else {
                  // Check new method (verificationData collection)
                  const verificationDoc = await getDoc(doc(db, 'verificationData', user.uid));
                  if (verificationDoc.exists()) {
                    const verificationData = verificationDoc.data();
                    verified = verificationData.status === 'approved';
                  }
                }
                
                setIsVerified(verified);
              }
            } else {
              // Regular users cannot monetize
              setIsVerified(false);
            }
          }
        } catch (error) {
          console.error('Error loading user profile:', error);
        }
      }
    };

    loadUserProfile();
  }, [user?.uid]);

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      processFile(selectedFile);
    }
  };

  const processFile = (selectedFile: File) => {
    setFile(selectedFile);
    const reader = new FileReader();
    reader.onloadend = () => {
      setFilePreview(reader.result as string);
    };
    reader.readAsDataURL(selectedFile);

    // Determine post type based on file type
    if (selectedFile.type.startsWith('image/')) {
      setPostType('image');
    } else if (selectedFile.type.startsWith('video/')) {
      setPostType('video');
    }
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
      setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      processFile(droppedFile);
    }
  };

  const handleAreaClick = () => {
    fileInputRef.current?.click();
  };

  const handleRemoveFile = () => {
    setFile(null);
        setFilePreview(null);
    setPostType('text');
  };

  const handleToggle360 = () => {
    if (postType === 'image') {
      setPostType('image360');
    } else if (postType === 'video') {
            setPostType('video360');
    } else if (postType === 'image360') {
      setPostType('image');
    } else if (postType === 'video360') {
      setPostType('video');
    }
  };

  const handleThumbnailChange = (file: File | null) => {
    setThumbnailFile(file);
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setThumbnailPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
          } else {
      setThumbnailPreview(null);
    }
  };


  const handleSubmit = async () => {
    if (!content.trim() && !file) return;

    // Prevent non-creators from uploading paid content
    if (accessLevel === 'paid_subscriber' && !isVerified) {
      alert('⚠️ Only verified creators can upload paid content. Please become a verified creator first, or set the post to Free.');
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      let mediaUrl = null;
      let thumbnailUrl = null;

      if (file) {
        mediaUrl = await uploadMedia(file, (progress) => {
          setUploadProgress(progress);
        });
      }

      if (thumbnailFile) {
        thumbnailUrl = await uploadMedia(thumbnailFile, (progress) => {
          setUploadProgress(progress);
        });
      }

      const postRef = await addDoc(collection(db, 'posts'), {
        content: content.trim(),
        authorId: userId,
        createdAt: new Date(),
        mediaUrl: mediaUrl,
        thumbnailUrl: thumbnailUrl,
        type: postType,
        isPublic: accessLevel === 'free',
        accessSettings: {
          accessLevel: accessLevel,
        },
        showWatermark: showWatermark,
        likes: 0,
        comments: 0,
        shares: 0,
        views: 0,
        taggedUsers: [],
        engagement: {
          views: 0,
          uniqueViews: 0,
          saveCount: 0,
          reportCount: 0,
          viewsByDay: {}
        },
      });

      console.log('Post created with ID:', postRef.id);
      onUploadComplete?.();
      onClose();
    } catch (error) {
      console.error('Error creating post:', error);
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleClose = () => {
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div 
      className="upload-master-container"
      onClick={(e) => {
        // Don't close when clicking outside - only close with X button
        // Completely disabled click outside to close
      }}
    >
      <div className="upload-card" onClick={(e) => e.stopPropagation()}>
        <div className="upload-title">
          Create post
        <Button
          variant="ghost"
          size="icon"
            className="absolute right-4 top-3 h-8 w-8 rounded-full hover:bg-gray-100 text-gray-600"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
        >
            <X className="h-5 w-5" />
        </Button>
        </div>

        {/* Step 1: Upload Content - Only show when step 1 */}
          {step === 1 && (
          <div className="upload-content">
            <div className="content-area">
              <div className="relative">
                <textarea
                  ref={contentRef}
                  value={content}
                  onChange={handleContentChange}
                  placeholder={`What's on your mind, ${user?.displayName?.split(' ')[0] || 'there'}?`}
                  className="text-input pr-8"
                  />
                  <button
                    type="button"
                    onClick={() => setContent(prev => prev + '😀')}
                    className="absolute right-2 top-2 p-1 hover:bg-gray-100 rounded-full transition-colors"
                  >
                    <Smile className="h-4 w-4 text-yellow-500" />
                    </button>
              </div>

              {!filePreview && (
                <div
                  ref={dropZoneRef}
                className={`upload-drop-zone relative ${
                  isDragging ? 'dragging' : ''
                  }`}
                  onDragEnter={handleDragEnter}
                  onDragLeave={handleDragLeave}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                >
                  <input
                    type="file"
                    id="file-upload"
                    accept="image/*,video/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <label
                    htmlFor="file-upload"
                  className="cursor-pointer flex flex-col items-center justify-center py-2"
                >
                  <Upload className="h-6 w-6 text-blue-500 mb-1" />
                  <span className="drop-text text-sm">Drop media here or click to upload</span>
                  </label>
                </div>
              )}

            {filePreview && (
              <div className="mt-4">
                {postType.startsWith('image') ? (
                  <div className="relative">
                      <img
                        src={filePreview}
                      alt="Preview"
                      className="w-full h-64 object-cover rounded-lg"
                    />
                    {showWatermark && (
                      <ContentWatermark 
                        username={username || user?.displayName || user?.email?.split('@')[0] || 'User'} 
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setFile(null);
                        setFilePreview(null);
                        setPostType('text');
                      }}
                      className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                    >
                      <X className="h-4 w-4" />
                    </button>
                    </div>
                ) : (
                  <div className="relative">
                      <video
                        ref={videoRef}
                      src={filePreview}
                      className="w-full h-64 object-cover rounded-lg"
                        controls
                    />
                    {showWatermark && (
                      <ContentWatermark 
                        username={username || user?.displayName || user?.email?.split('@')[0] || 'User'} 
                      />
                    )}
                    <button
                      type="button"
                    onClick={() => {
                      setFile(null);
                      setFilePreview(null);
                      setPostType('text');
                    }}
                      className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            )}
                  </div>
                </div>
              )}

        {/* Settings - Only show when step 1 */}
        {step === 1 && (
          <div className="upload-settings">
            <div className="setting-row">
              <div className="setting-info">
                <div className="setting-label">360° Mode</div>
                <div className="setting-description">Enable 360° content viewing</div>
              </div>
              <div className="setting-control">
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={postType === 'video360' || postType === 'image360'}
                    onChange={(e) => {
                      e.stopPropagation();
                      handleToggle360();
                    }}
                    className="checkbox"
                  />
                  <span className="slider"></span>
                </label>
              </div>
            </div>

            {/* Post Visibility - Only show to creators */}
            {isCreatorRole && (
              <div className="setting-row">
                <div className="setting-info">
                  <div className="setting-label">Post Visibility</div>
                  <div className="setting-description">
                    {!isVerified ? (
                      <span className="text-amber-600">⚠️ Creator verification required to monetize content. Currently: Free only</span>
                    ) : (
                      accessLevel === 'free' ? 'Everyone can see this content' : 
                      accessLevel === 'free_subscriber' ? 'Free + Paid subscribers can see this content' :
                      accessLevel === 'paid_subscriber' ? 'Only paid subscribers can see this content' : 'Unknown'
                    )}
                  </div>
                </div>
                <div className="setting-control">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        disabled={!isVerified}
                        className="w-fit px-3 py-2 text-xs font-medium transition-all duration-200 focus:outline-none focus:ring-0 focus:ring-offset-0 focus:border-none hover:shadow-lg hover:scale-[1.02] focus:shadow-lg focus:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-none flex items-center gap-2"
                        style={{
                          borderRadius: '8px',
                          border: '1px solid #e5e7eb',
                          background: 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)',
                          boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.05), inset 0 1px 0 rgba(255, 255, 255, 0.8)',
                        }}
                        title={!isVerified ? 'Complete creator verification to enable paid content' : ''}
                      >
                        <span>
                          {accessLevel === 'free' ? 'Everyone' :
                           accessLevel === 'free_subscriber' ? 'Free + Paid Subscribers' :
                           accessLevel === 'paid_subscriber' ? 'Paid Subscribers Only' : 'Select visibility'}
                        </span>
                        <ChevronDown className="h-3 w-3 text-gray-600" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent 
                      align="start" 
                      className="w-48 bg-white border-0 overflow-hidden p-0"
                      style={{
                        borderRadius: '8px',
                        boxShadow: '0 8px 16px rgba(0, 0, 0, 0.15), 0 2px 4px rgba(0, 0, 0, 0.1)',
                        background: 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)',
                      }}
                    >
                      <DropdownMenuItem
                        onClick={() => isVerified && setAccessLevel('free')}
                        className="text-xs py-2 px-3 cursor-pointer hover:bg-blue-50 transition-colors"
                        style={{
                          background: accessLevel === 'free' ? 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)' : 'transparent',
                          color: accessLevel === 'free' ? 'white' : 'inherit',
                        }}
                      >
                        Everyone
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => isVerified && setAccessLevel('free_subscriber')}
                        className="text-xs py-2 px-3 cursor-pointer hover:bg-blue-50 transition-colors"
                        style={{
                          background: accessLevel === 'free_subscriber' ? 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)' : 'transparent',
                          color: accessLevel === 'free_subscriber' ? 'white' : 'inherit',
                        }}
                      >
                        Free + Paid Subscribers
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => isVerified && setAccessLevel('paid_subscriber')}
                        className="text-xs py-2 px-3 cursor-pointer hover:bg-blue-50 transition-colors"
                        style={{
                          background: accessLevel === 'paid_subscriber' ? 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)' : 'transparent',
                          color: accessLevel === 'paid_subscriber' ? 'white' : 'inherit',
                        }}
                      >
                        Paid Subscribers Only
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            )}

            <div className="setting-row">
              <div className="setting-info">
                <div className="setting-label">Show Watermark on Media</div>
                <div className="setting-description">Add watermark to protect your content</div>
              </div>
              <div className="setting-control">
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showWatermark}
                    onChange={(e) => {
                      e.stopPropagation();
                      setShowWatermark(!showWatermark);
                    }}
                    className="checkbox"
                  />
                  <span className="slider"></span>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Thumbnail Upload - Transform Form */}
        {step === 2 && file && file.type.startsWith('video/') && (
          <div className="upload-content">
            <div className="upload-title">Add Video Thumbnail</div>
            <div className="upload-settings">
              <VideoThumbnailUpload
                onThumbnailChange={handleThumbnailChange}
                currentThumbnail={thumbnailPreview || undefined}
              />
            </div>
          </div>
        )}

        <div className="upload-actions">
          <div className="actions-content">
              {file && file.type.startsWith('video/') ? (
              <div className="action-buttons">
                {step === 1 ? (
                  <>
                    <button
                    type="button"
                      className="btn-cancel"
                    onClick={() => setStep(2)}
                  >
                    Add a thumbnail
                    </button>
                    <button
                      type="button"
                      className="btn-submit"
                      onClick={handleSubmit}
                      disabled={isUploading || (!content.trim() && !file)}
                    >
                      {isUploading ? 'Posting...' : 'POST'}
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      className="btn-cancel"
                      onClick={() => setStep(1)}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="btn-submit"
                      onClick={() => setStep(1)}
                    >
                      Add
                    </button>
                    <button
                      type="button"
                      className="btn-submit"
                      onClick={handleSubmit}
                    disabled={isUploading || (!content.trim() && !file)}
                  >
                      {isUploading ? 'Posting...' : 'POST'}
                    </button>
                  </>
                )}
                </div>
              ) : (
              <div className="action-buttons">
                <button
                    type="button"
                    className="btn-cancel"
                    onClick={handleClose}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn-submit"
                    onClick={handleSubmit}
                    disabled={isUploading || (!content.trim() && !file)}
                  >
                    {isUploading ? 'Posting...' : 'POST'}
                  </button>
                </div>
              )}
            </div>
        </div>
      </div>
    </div>
  );
}
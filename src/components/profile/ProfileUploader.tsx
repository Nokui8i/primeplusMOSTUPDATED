import { useState, useRef, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X } from 'lucide-react';
import Image from 'next/image';
import { ProfilePhoto } from './ProfilePhoto';

interface ProfileUploaderProps {
  photoUrl?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  onPhotoUpdate?: (url: string) => void;
}

const sizeMap = {
  sm: 40,
  md: 80,
  lg: 168,
};

export function ProfileUploader({ photoUrl, size = 'md', className = '', onPhotoUpdate }: ProfileUploaderProps) {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [showCropper, setShowCropper] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      setUploadedFile(file);
      setShowCropper(true);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.gif']
    },
    maxFiles: 1,
    multiple: false
  });

  const handlePhotoUpdate = (url: string) => {
    setShowCropper(false);
    setUploadedFile(null);
    onPhotoUpdate?.(url);
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

  return (
    <div className={className}>
      {showCropper && uploadedFile ? (
        <ProfilePhoto
          photoUrl={URL.createObjectURL(uploadedFile)}
          size={size}
          onPhotoUpdate={handlePhotoUpdate}
        />
      ) : (
        <div className="relative">
          {/* Current Profile Photo */}
          <div 
            className="relative rounded-full overflow-hidden mb-4"
            style={{ width: sizeMap[size], height: sizeMap[size] }}
          >
            {photoUrl ? (
              <Image
                src={photoUrl}
                alt="Profile photo"
                fill
                className="object-cover"
                sizes={`${sizeMap[size]}px`}
                unoptimized={photoUrl.includes('firebasestorage.googleapis.com')}
              />
            ) : (
              <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                <span className="text-gray-400 text-xl">?</span>
              </div>
            )}
          </div>

          {/* Upload Interface */}
          <div
            ref={dropZoneRef}
            {...getRootProps()}
            className={`relative border-2 border-dashed rounded-lg p-4 transition-all duration-200 ${
              isDragActive 
                ? 'border-blue-500 bg-blue-500/10' 
                : 'border-gray-300 hover:border-gray-400'
            }`}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
          >
            <input {...getInputProps()} />
            <div className="flex flex-col items-center justify-center gap-2">
              <Upload className={`w-6 h-6 ${isDragActive ? 'text-blue-500' : 'text-gray-400'}`} />
              <p className={`text-sm ${isDragActive ? 'text-blue-500' : 'text-gray-500'}`}>
                {isDragActive ? 'Drop your photo here' : 'Drag & drop or click to upload'}
              </p>
              <p className="text-xs text-gray-400">
                Supports JPG, PNG, GIF
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 
'use client';

import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { uploadToS3, generateS3Key } from '@/lib/aws/s3';
import { getAuth } from 'firebase/auth';

export interface UploadTask {
  id: string;
  file: File;
  progress: number;
  speed: number;
  timeRemaining: string;
  status: 'uploading' | 'completed' | 'error' | 'paused';
  error?: string;
  completedAt?: Date;
  isPaused?: boolean;
  downloadURL?: string;
}

interface UploadContextType {
  uploads: UploadTask[];
  addUpload: (file: File) => void;
  cancelUpload: (id: string) => void;
  clearCompleted: () => void;
  pauseUpload: (id: string) => void;
  resumeUpload: (id: string) => void;
  editUpload: (id: string) => void;
  startUpload: (file: File, path: string) => Promise<string>;
}

const UploadContext = createContext<UploadContextType | undefined>(undefined);

export function UploadProvider({ children }: { children: React.ReactNode }) {
  const [uploads, setUploads] = useState<UploadTask[]>([]);
  const uploadTasksRef = useRef<{ [key: string]: any }>({});

  const startUpload = useCallback(async (file: File, path: string): Promise<string> => {
    const id = uuidv4();
    const newUpload: UploadTask = {
      id,
      file,
      progress: 0,
      speed: 0,
      timeRemaining: 'Calculating...',
      status: 'uploading',
      isPaused: false
    };

    setUploads(prev => [...prev, newUpload]);

    try {
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) throw new Error('Must be logged in to upload');

      // Determine content type based on file type
      let contentType: 'images' | 'videos' | 'audio' | 'documents';
      if (file.type.startsWith('image/')) {
        contentType = 'images';
      } else if (file.type.startsWith('video/')) {
        contentType = 'videos';
      } else if (file.type.startsWith('audio/')) {
        contentType = 'audio';
      } else {
        contentType = 'documents';
      }

      // Generate S3 key
      const s3Key = generateS3Key(user.uid, file.name, contentType);

      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setUploads(prev => prev.map(upload => {
          if (upload.id === id && upload.status === 'uploading') {
            const newProgress = Math.min(upload.progress + Math.random() * 10, 95);
            return {
              ...upload,
              progress: newProgress,
              speed: Math.random() * 1000000, // Random speed
              timeRemaining: newProgress > 90 ? 'Almost done...' : 'Calculating...'
            };
          }
          return upload;
        }));
      }, 500);

      // Upload to S3
      const cloudFrontUrl = await uploadToS3(file, s3Key, (progress) => {
        setUploads(prev => prev.map(upload => {
          if (upload.id === id) {
            return {
              ...upload,
              progress,
              timeRemaining: progress > 90 ? 'Almost done...' : 'Uploading...'
            };
          }
          return upload;
        }));
      });

      clearInterval(progressInterval);

      // Mark as completed
      setUploads(prev => prev.map(upload => {
        if (upload.id === id) {
          return {
            ...upload,
            status: 'completed',
            completedAt: new Date(),
            downloadURL: cloudFrontUrl,
            progress: 100
          };
        }
        return upload;
      }));

      return cloudFrontUrl;
    } catch (error) {
      setUploads(prev => prev.map(upload => {
        if (upload.id === id) {
          return {
            ...upload,
            status: 'error',
            error: error instanceof Error ? error.message : 'Upload failed'
          };
        }
        return upload;
      }));
      throw error;
    }
  }, []);

  const addUpload = useCallback(async (file: File) => {
    const id = uuidv4();
    const newUpload: UploadTask = {
      id,
      file,
      progress: 0,
      speed: 0,
      timeRemaining: 'Calculating...',
      status: 'uploading',
      isPaused: false
    };

    setUploads(prev => [...prev, newUpload]);

    try {
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) throw new Error('Must be logged in to upload');

      // Determine content type based on file type
      let contentType: 'images' | 'videos' | 'audio' | 'documents';
      if (file.type.startsWith('image/')) {
        contentType = 'images';
      } else if (file.type.startsWith('video/')) {
        contentType = 'videos';
      } else if (file.type.startsWith('audio/')) {
        contentType = 'audio';
      } else {
        contentType = 'documents';
      }

      // Generate S3 key
      const s3Key = generateS3Key(user.uid, file.name, contentType);

      // Upload to S3
      const cloudFrontUrl = await uploadToS3(file, s3Key, (progress) => {
        setUploads(prev => prev.map(upload => {
          if (upload.id === id) {
            return {
              ...upload,
              progress,
              timeRemaining: progress > 90 ? 'Almost done...' : 'Uploading...'
            };
          }
          return upload;
        }));
      });

      // Mark as completed
      setUploads(prev => prev.map(upload => {
        if (upload.id === id) {
          return {
            ...upload,
            status: 'completed',
            completedAt: new Date(),
            downloadURL: cloudFrontUrl,
            progress: 100
          };
        }
        return upload;
      }));
    } catch (error) {
      setUploads(prev => prev.map(upload => {
        if (upload.id === id) {
          return {
            ...upload,
            status: 'error',
            error: error instanceof Error ? error.message : 'Upload failed'
          };
        }
        return upload;
      }));
    }
  }, []);

  const cancelUpload = useCallback((id: string) => {
    const uploadTask = uploadTasksRef.current[id];
    if (uploadTask) {
      uploadTask.cancel();
      delete uploadTasksRef.current[id];
    }
    setUploads(prev => prev.filter(upload => upload.id !== id));
  }, []);

  const clearCompleted = useCallback(() => {
    setUploads(prev => prev.filter(upload => upload.status !== 'completed'));
  }, []);

  const pauseUpload = useCallback((id: string) => {
    const uploadTask = uploadTasksRef.current[id];
    if (uploadTask) {
      uploadTask.pause();
      setUploads(prev => prev.map(upload => {
        if (upload.id === id) {
          return {
            ...upload,
            isPaused: true,
            status: 'paused'
          };
        }
        return upload;
      }));
    }
  }, []);

  const resumeUpload = useCallback((id: string) => {
    const uploadTask = uploadTasksRef.current[id];
    if (uploadTask) {
      uploadTask.resume();
      setUploads(prev => prev.map(upload => {
        if (upload.id === id) {
          return {
            ...upload,
            isPaused: false,
            status: 'uploading'
          };
        }
        return upload;
      }));
    }
  }, []);

  const editUpload = useCallback((id: string) => {
    // This will be implemented in the UI layer
    console.log('Edit upload:', id);
  }, []);

  return (
    <UploadContext.Provider value={{
      uploads,
      addUpload,
      cancelUpload,
      clearCompleted,
      pauseUpload,
      resumeUpload,
      editUpload,
      startUpload
    }}>
      {children}
    </UploadContext.Provider>
  );
}

export function useUpload() {
  const context = useContext(UploadContext);
  if (context === undefined) {
    throw new Error('useUpload must be used within a UploadProvider');
  }
  return context;
} 
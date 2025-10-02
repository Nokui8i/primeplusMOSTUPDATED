export interface UploadTask {
  id: string;
  file: File;
  progress: number;
  speed: number;
  timeRemaining: string;
  status: 'uploading' | 'completed' | 'error' | 'paused';
  error?: string;
  completedAt?: Date;
  isPaused: boolean;
  downloadURL?: string;
  metadata?: {
    contentType: string;
    size: number;
    lastModified: number;
    name: string;
  };
} 
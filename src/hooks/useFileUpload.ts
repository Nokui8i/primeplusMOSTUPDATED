import { useState, useRef, useCallback } from 'react';

interface UploadProgress {
  progress: number;
  bytesUploaded: number;
  totalBytes: number;
  uploadSpeed: number;
  timeRemaining: number;
}

interface UploadState extends UploadProgress {
  status: 'idle' | 'uploading' | 'completed' | 'error';
  error?: string;
}

interface UseFileUploadOptions {
  url: string;
  onSuccess?: (response: any) => void;
  onError?: (error: Error) => void;
  headers?: Record<string, string>;
}

// Create a custom XMLHttpRequest to track upload progress
const createUploadXHR = (
  onProgress: (event: ProgressEvent) => void,
  signal?: AbortSignal
): XMLHttpRequest => {
  const xhr = new XMLHttpRequest();
  
  xhr.upload.addEventListener('progress', onProgress);
  
  if (signal) {
    signal.addEventListener('abort', () => xhr.abort());
  }
  
  return xhr;
};

export function useFileUpload(options: UseFileUploadOptions) {
  const [uploadState, setUploadState] = useState<UploadState>({
    status: 'idle',
    progress: 0,
    bytesUploaded: 0,
    totalBytes: 0,
    uploadSpeed: 0,
    timeRemaining: 0,
  });

  const abortControllerRef = useRef<AbortController | null>(null);
  const uploadStartTimeRef = useRef<number>(0);
  const lastBytesUploadedRef = useRef<number>(0);
  const lastUpdateTimeRef = useRef<number>(0);

  const calculateProgress = useCallback((loaded: number, total: number, currentTime: number): UploadProgress => {
    const progress = (loaded / total) * 100;
    const timeDiff = (currentTime - lastUpdateTimeRef.current) / 1000; // Convert to seconds
    const bytesDiff = loaded - lastBytesUploadedRef.current;
    
    const uploadSpeed = timeDiff > 0 ? bytesDiff / timeDiff : 0;
    const remainingBytes = total - loaded;
    const timeRemaining = uploadSpeed > 0 ? remainingBytes / uploadSpeed : 0;

    lastBytesUploadedRef.current = loaded;
    lastUpdateTimeRef.current = currentTime;

    return {
      progress,
      bytesUploaded: loaded,
      totalBytes: total,
      uploadSpeed,
      timeRemaining,
    };
  }, []);

  const upload = useCallback(async (file: File) => {
    try {
      abortControllerRef.current?.abort();
      abortControllerRef.current = new AbortController();

      const formData = new FormData();
      formData.append('file', file);

      uploadStartTimeRef.current = Date.now();
      lastUpdateTimeRef.current = uploadStartTimeRef.current;
      lastBytesUploadedRef.current = 0;

      setUploadState(prev => ({
        ...prev,
        status: 'uploading',
        error: undefined,
      }));

      return new Promise<any>((resolve, reject) => {
        const xhr = createUploadXHR(
          (event: ProgressEvent) => {
            const progressData = calculateProgress(event.loaded, event.total, Date.now());
            setUploadState(prev => ({
              ...prev,
              ...progressData,
            }));
          },
          abortControllerRef.current?.signal
        );

        xhr.open('POST', options.url);

        // Set headers
        if (options.headers) {
          Object.entries(options.headers).forEach(([key, value]) => {
            xhr.setRequestHeader(key, value);
          });
        }

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            const response = JSON.parse(xhr.responseText);
            setUploadState(prev => ({
              ...prev,
              status: 'completed',
              progress: 100,
            }));
            options.onSuccess?.(response);
            resolve(response);
          } else {
            const error = new Error(`Upload failed with status ${xhr.status}`);
            setUploadState(prev => ({
              ...prev,
              status: 'error',
              error: error.message,
            }));
            options.onError?.(error);
            reject(error);
          }
        };

        xhr.onerror = () => {
          const error = new Error('Network error occurred during upload');
          setUploadState(prev => ({
            ...prev,
            status: 'error',
            error: error.message,
          }));
          options.onError?.(error);
          reject(error);
        };

        xhr.send(formData);
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }

      const errorToThrow = error instanceof Error ? error : new Error('Upload failed');
      setUploadState(prev => ({
        ...prev,
        status: 'error',
        error: errorToThrow.message,
      }));

      options.onError?.(errorToThrow);
      throw errorToThrow;
    }
  }, [options, calculateProgress]);

  const cancelUpload = useCallback(() => {
    abortControllerRef.current?.abort();
    setUploadState(prev => ({
      ...prev,
      status: 'idle',
      progress: 0,
      bytesUploaded: 0,
      totalBytes: 0,
      uploadSpeed: 0,
      timeRemaining: 0,
      error: undefined,
    }));
  }, []);

  return {
    upload,
    cancelUpload,
    uploadState,
  };
} 
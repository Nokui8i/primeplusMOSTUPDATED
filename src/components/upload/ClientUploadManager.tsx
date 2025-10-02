'use client';

import React, { useState } from 'react';
import { useUpload } from '@/contexts/UploadContext';
import UploadManager from './UploadManager';
import type { UploadTask } from '@/contexts/UploadContext';
import EditUploadDialog from './EditUploadDialog';

export default function ClientUploadManager() {
  const { uploads, cancelUpload, clearCompleted, pauseUpload, resumeUpload, editUpload } = useUpload();
  const [isMinimized, setIsMinimized] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const handleEdit = (id: string) => {
    setEditId(id);
  };

  const handleCloseEdit = () => {
    setEditId(null);
  };

  const uploadToEdit = uploads.find(u => u.id === editId);

  const handleUploadComplete = (task: UploadTask) => {
    console.log('Upload completed:', task);
  };

  const handleUploadError = (error: string) => {
    console.error('Upload error:', error);
  };

  if (uploads.length === 0) return null;
  
  return (
    <>
      <UploadManager
        uploads={uploads}
        isMinimized={isMinimized}
        onMinimize={() => setIsMinimized(true)}
        onMaximize={() => setIsMinimized(false)}
        onCancel={cancelUpload}
        onClearCompleted={clearCompleted}
        onPause={pauseUpload}
        onResume={resumeUpload}
        onEdit={handleEdit}
        onUploadComplete={handleUploadComplete}
        onUploadError={handleUploadError}
      />
      {editId && uploadToEdit && (
        <EditUploadDialog
          upload={uploadToEdit}
          onClose={handleCloseEdit}
        />
      )}
    </>
  );
} 
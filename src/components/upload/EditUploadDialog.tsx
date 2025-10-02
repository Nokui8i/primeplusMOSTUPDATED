import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { UploadTask } from '@/contexts/UploadContext';

interface EditUploadDialogProps {
  upload: UploadTask;
  onClose: () => void;
}

const EditUploadDialog: React.FC<EditUploadDialogProps> = ({ upload, onClose }) => {
  const [text, setText] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setImage(file);
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setPreview(reader.result as string);
      reader.readAsDataURL(file);
    } else {
      setPreview(null);
    }
  };

  const handleSave = () => {
    // Implement save logic here (update upload metadata, etc.)
    onClose();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Upload</DialogTitle>
        </DialogHeader>
        <div className="mb-4">
          <div className="mb-2 font-medium">Current File:</div>
          <div className="mb-2 text-sm">{upload.file.name}</div>
          <img
            src={preview || URL.createObjectURL(upload.file)}
            alt="Preview"
            className="w-full max-h-48 object-contain mb-2 rounded"
          />
          <input type="file" accept="image/*" onChange={handleImageChange} />
        </div>
        <div className="mb-4">
          <textarea
            className="w-full border rounded p-2"
            rows={3}
            placeholder="Add or edit text..."
            value={text}
            onChange={e => setText(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EditUploadDialog; 
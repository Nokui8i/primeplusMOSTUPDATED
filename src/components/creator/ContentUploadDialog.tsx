import React from 'react';
import {
  Dialog,
  DialogTrigger,
  DialogTitle,
  DialogPortal,
  DialogOverlay,
} from "@/components/ui/dialog"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { Button } from '@/components/ui/button';
import { ImagePlus, MessageCircle, Sparkles, Upload } from 'lucide-react';
import ContentUpload from './ContentUpload';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useAuth } from '@/lib/firebase/auth';

interface ContentUploadDialogProps {
  triggerClassName?: string;
  onUploadComplete?: () => void;
  children?: React.ReactNode;
}

export function ContentUploadDialog({ triggerClassName, onUploadComplete, children }: ContentUploadDialogProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const { user } = useAuth();

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {children ? (
          <span className={triggerClassName}>{children}</span>
        ) : (
          <button 
            className="btn-upload w-full"
            onClick={() => setIsOpen(true)}
          >
            <Upload className="w-4 h-4 mr-2" />
            Upload
          </button>
        )}
      </DialogTrigger>
      <DialogPortal>
        <DialogOverlay />
        <DialogPrimitive.Content
          className="fixed left-[50%] top-[50%] z-50 w-full max-w-[500px] translate-x-[-50%] translate-y-[-50%] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]"
        >
          <DialogTitle className="sr-only">Create Post</DialogTitle>
          {user ? (
            <ContentUpload 
              isOpen={isOpen}
              onClose={() => setIsOpen(false)}
              onUploadComplete={() => {
                setIsOpen(false);
                onUploadComplete?.();
              }} 
              userId={user.uid}
            />
          ) : (
            <div className="p-4 text-center">
              <p className="text-gray-500">Please sign in to create posts.</p>
            </div>
          )}
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
} 
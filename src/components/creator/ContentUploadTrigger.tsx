import React, { useState } from 'react';
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import ContentUpload from './ContentUpload';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from '@/lib/firebase/auth';

export function ContentUploadTrigger() {
  const [isOpen, setIsOpen] = useState(false);
  const { user } = useAuth();

  return (
    <>
      <div className="flex items-center gap-3 p-3 border rounded-full bg-gray-50 hover:bg-gray-100 cursor-pointer transition-colors" onClick={() => setIsOpen(true)}>
        <Avatar className="h-8 w-8">
          <AvatarImage src={user?.photoURL || undefined} />
          <AvatarFallback>{user?.displayName?.[0] || 'U'}</AvatarFallback>
        </Avatar>
        <div className="flex-1 text-gray-500 text-sm">
          What's on your mind?
        </div>
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogTitle className="text-lg font-semibold mb-4">Create Post</DialogTitle>
          <ContentUpload 
            isOpen={isOpen}
            onClose={() => setIsOpen(false)}
            userId={user?.uid || ''}
            onUploadComplete={() => setIsOpen(false)} 
          />
        </DialogContent>
      </Dialog>
    </>
  );
} 
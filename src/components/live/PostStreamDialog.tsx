import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface PostStreamDialogProps {
  isOpen: boolean;
  onClose: () => void;
  streamId: string;
  streamData: {
    title: string;
    description: string;
    userId: string;
    username: string;
    startedAt: number;
    endedAt: number;
    viewerCount: number;
    thumbnail?: string;
  };
}

export function PostStreamDialog({ isOpen, onClose, streamId, streamData }: PostStreamDialogProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [postData, setPostData] = useState({
    title: streamData.title,
    description: streamData.description,
    isPublic: true,
    allowComments: true,
    allowReactions: true,
  });

  const handleSave = async () => {
    try {
      setIsSaving(true);
      
      // Create post document
      const postRef = doc(db, 'posts', `post_${streamId}`);
      await setDoc(postRef, {
        ...postData,
        type: 'stream',
        streamId,
        authorId: streamData.userId,
        authorName: streamData.username,
        createdAt: streamData.startedAt,
        updatedAt: Date.now(),
        duration: streamData.endedAt - streamData.startedAt,
        viewerCount: streamData.viewerCount,
        thumbnail: streamData.thumbnail,
        status: 'published'
      });

      toast.success('Stream saved as post successfully!');
      onClose();
    } catch (error) {
      console.error('Error saving stream as post:', error);
      toast.error('Failed to save stream as post');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Save Stream as Post</DialogTitle>
          <DialogDescription>
            Your stream has ended. Would you like to save it as a post?
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div>
            <Label>Title</Label>
            <Input
              value={postData.title}
              onChange={(e) => setPostData({ ...postData, title: e.target.value })}
              placeholder="Enter post title"
            />
          </div>
          
          <div>
            <Label>Description</Label>
            <Textarea
              value={postData.description}
              onChange={(e) => setPostData({ ...postData, description: e.target.value })}
              placeholder="Enter post description"
            />
          </div>
          
          <div className="flex items-center justify-between">
            <Label>Public Post</Label>
            <Switch
              checked={postData.isPublic}
              onCheckedChange={(checked) => setPostData({ ...postData, isPublic: checked })}
            />
          </div>
          
          <div className="flex items-center justify-between">
            <Label>Allow Comments</Label>
            <Switch
              checked={postData.allowComments}
              onCheckedChange={(checked) => setPostData({ ...postData, allowComments: checked })}
            />
          </div>
          
          <div className="flex items-center justify-between">
            <Label>Allow Reactions</Label>
            <Switch
              checked={postData.allowReactions}
              onCheckedChange={(checked) => setPostData({ ...postData, allowReactions: checked })}
            />
          </div>
        </div>
        
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save as Post'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
} 
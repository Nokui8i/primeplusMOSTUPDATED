'use client';

import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Upload, X, Send, Loader2, Image, Video, DollarSign } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { uploadToS3 } from '@/lib/aws/s3';
import { collection, query, where, getDocs, addDoc, serverTimestamp, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { useAuth } from '@/hooks/useAuth';

interface BulkMessageModalProps {
  open: boolean;
  onClose: () => void;
}

export default function BulkMessageModal({ open, onClose }: BulkMessageModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [message, setMessage] = useState('');
  const [price, setPrice] = useState<number | null>(null);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video' | null>(null);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (10MB for images, 50MB for videos)
    const maxSize = file.type.startsWith('video/') ? 50 * 1024 * 1024 : 10 * 1024 * 1024;
    if (file.size > maxSize) {
      toast({
        title: "Error",
        description: `File size must be less than ${maxSize / (1024 * 1024)}MB`,
        variant: "destructive",
      });
      return;
    }

    setMediaFile(file);
    setUploading(true);

    try {
      const fileType = file.type.startsWith('video/') ? 'video' : 'image';
      const folder = fileType === 'video' ? 'bulk-videos' : 'bulk-images';
      const mediaUrl = await uploadToS3(file, `${folder}/${user?.uid}/${Date.now()}-${file.name}`);
      
      setMediaUrl(mediaUrl);
      setMediaType(fileType);
      
      toast({
        title: "Success",
        description: `${fileType === 'video' ? 'Video' : 'Image'} uploaded successfully`,
      });
    } catch (error) {
      console.error('Error uploading media:', error);
      toast({
        title: "Error",
        description: "Failed to upload media",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const removeMedia = () => {
    setMediaFile(null);
    setMediaUrl(null);
    setMediaType(null);
  };

  const handleSend = async () => {
    if (!user?.uid || !message.trim()) {
      toast({
        title: "Error",
        description: "Please enter a message",
        variant: "destructive",
      });
      return;
    }

    setSending(true);

    try {
      // Get all active subscribers
      const subscriptionsQuery = query(
        collection(db, 'subscriptions'),
        where('creatorId', '==', user.uid),
        where('status', '==', 'active')
      );
      
      const subscriptionsSnapshot = await getDocs(subscriptionsQuery);
      const subscribers = subscriptionsSnapshot.docs.map(doc => doc.data().subscriberId);

      if (subscribers.length === 0) {
        toast({
          title: "No subscribers",
          description: "You don't have any active subscribers to send messages to",
          variant: "destructive",
        });
        setSending(false);
        return;
      }

      // Send message to each subscriber
      const messagePromises = subscribers.map(async (subscriberId) => {
        const chatId = [user.uid, subscriberId].sort().join('_');
        
        const messageData: any = {
          senderId: user.uid,
          receiverId: subscriberId,
          content: message.trim(),
          type: mediaType || 'text',
          timestamp: serverTimestamp(),
          read: false,
          senderName: user.displayName || 'Creator',
          senderPhotoURL: user.photoURL,
        };

        // Add media if present
        if (mediaUrl && mediaType) {
          if (mediaType === 'image') {
            messageData.imageUrl = mediaUrl;
          } else if (mediaType === 'video') {
            messageData.videoUrl = mediaUrl;
          }
        }

        // Add price if PPV
        if (price && price > 0) {
          messageData.locked = true;
          messageData.price = price;
        }

        // Add to messages collection
        await addDoc(collection(db, 'messages'), messageData);

        // Update chat document
        const chatRef = doc(db, 'chats', chatId);
        await addDoc(collection(db, 'chats', chatId, 'messages'), messageData);
      });

      await Promise.all(messagePromises);

      toast({
        title: "Success",
        description: `Message sent to ${subscribers.length} subscribers`,
      });

      // Reset form
      setMessage('');
      setPrice(null);
      setMediaFile(null);
      setMediaUrl(null);
      setMediaType(null);
      onClose();

    } catch (error) {
      console.error('Error sending bulk message:', error);
      toast({
        title: "Error",
        description: "Failed to send messages",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Bulk Message to Subscribers
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Message Input */}
          <div className="space-y-2">
            <Label htmlFor="bulk-message">Message</Label>
            <Textarea
              id="bulk-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type your message here..."
              className="min-h-[100px] resize-none"
              maxLength={1000}
            />
            <div className="text-xs text-gray-500 text-right">
              {message.length}/1000 characters
            </div>
          </div>

          {/* Media Upload */}
          <div className="space-y-2">
            <Label>Media (Optional)</Label>
            {mediaUrl ? (
              <div className="relative">
                {mediaType === 'image' ? (
                  <img
                    src={mediaUrl}
                    alt="Media preview"
                    className="w-full h-32 object-cover rounded-lg border border-gray-200"
                  />
                ) : (
                  <video
                    src={mediaUrl}
                    className="w-full h-32 object-cover rounded-lg border border-gray-200"
                    controls
                  />
                )}
                <button
                  onClick={removeMedia}
                  className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-gray-300 rounded-lg p-3 text-center cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-colors"
              >
                <Upload className="h-4 w-4 text-gray-400 mx-auto mb-1" />
                <p className="text-xs text-gray-600">Upload media</p>
              </div>
            )}
            
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              onChange={handleFileSelect}
              className="hidden"
            />
            
            {uploading && (
              <div className="flex items-center justify-center py-2">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                <span className="text-sm text-gray-600">Uploading...</span>
              </div>
            )}
          </div>

          {/* PPV Price */}
          <div className="space-y-2">
            <Label htmlFor="bulk-price">Price (Optional - Leave empty for free)</Label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                id="bulk-price"
                type="number"
                value={price || ''}
                onChange={(e) => setPrice(e.target.value ? Number(e.target.value) : null)}
                placeholder="0.00"
                className="pl-10"
                min="0"
                step="0.01"
              />
            </div>
            {price && price > 0 && (
              <p className="text-xs text-gray-500">
                This will be sent as a PPV message to all subscribers
              </p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={sending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSend}
              disabled={sending || !message.trim()}
              className="profile-btn"
              style={{
                border: 'none',
                color: '#fff',
                backgroundImage: 'linear-gradient(30deg, #0400ff, #4ce3f7)',
                backgroundColor: 'transparent',
                borderRadius: '20px',
                backgroundSize: '100% auto',
                fontFamily: 'inherit',
                fontSize: '11px',
                padding: '0.3em 0.6em',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                cursor: 'pointer',
                outline: 'none',
                transition: 'all 0.3s ease-in-out',
                boxShadow: 'none',
                margin: '0',
                width: 'auto',
                height: 'auto',
                fontWeight: '700',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              {sending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Send className="h-3 w-3" />
              )}
              {sending ? 'Sending...' : 'Send to All'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { db } from '@/lib/firebase/config';
import { doc, getDoc, updateDoc, collection, query, where, getDocs, addDoc, serverTimestamp, setDoc, writeBatch } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MessageSquare, Save, Loader2, Image, X, Upload, Send, DollarSign, ChevronDown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { uploadToS3 } from '@/lib/aws/s3';

export default function SettingsTab() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [welcomeMessage, setWelcomeMessage] = useState('');
  const [welcomeImage, setWelcomeImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [openSections, setOpenSections] = useState({
    bulkMessage: false,
    welcomeMessage: false,
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Bulk message states
  const [bulkMessageContent, setBulkMessageContent] = useState('');
  const [bulkMediaFile, setBulkMediaFile] = useState<File | null>(null);
  const [bulkMediaPreview, setBulkMediaPreview] = useState<string | null>(null);
  const [bulkMediaType, setBulkMediaType] = useState<'image' | 'video' | null>(null);
  const [bulkIsPaid, setBulkIsPaid] = useState(false);
  const [bulkPrice, setBulkPrice] = useState<number>(0);
  const [sendingBulkMessage, setSendingBulkMessage] = useState(false);
  const [uploadingBulkMedia, setUploadingBulkMedia] = useState(false);
  const bulkFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function loadSettings() {
      if (!user?.uid) {
        setLoading(false);
        return;
      }

      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          setWelcomeMessage(userData.welcomeMessage || '');
          setWelcomeImage(userData.welcomeImage || null);
        }
      } catch (error) {
        console.error('Error loading settings:', error);
        toast({
          title: "Error",
          description: "Failed to load settings",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    }

    loadSettings();
  }, [user?.uid, toast]);

  const handleImageUpload = async (file: File) => {
    if (!user?.uid) return;

    setUploadingImage(true);
    try {
      const imageUrl = await uploadToS3(file, `welcome-images/${user.uid}/${Date.now()}-${file.name}`);
      setWelcomeImage(imageUrl);
      toast({
        title: "Success",
        description: "Image uploaded successfully",
      });
    } catch (error) {
      console.error('Error uploading image:', error);
      toast({
        title: "Error",
        description: "Failed to upload image",
        variant: "destructive",
      });
    } finally {
      setUploadingImage(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        toast({
          title: "Error",
          description: "Image size must be less than 5MB",
          variant: "destructive",
        });
        return;
      }
      if (!file.type.startsWith('image/')) {
        toast({
          title: "Error",
          description: "Please select an image file",
          variant: "destructive",
        });
        return;
      }
      handleImageUpload(file);
    }
  };

  const removeImage = () => {
    setWelcomeImage(null);
  };

  // Bulk message functions
  const handleBulkFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 50 * 1024 * 1024) { // 50MB limit for video, 10MB for image
        toast({
          title: "Error",
          description: "File size must be less than 50MB for video or 10MB for image.",
          variant: "destructive",
        });
        return;
      }

      if (file.type.startsWith('image/')) {
        if (file.size > 10 * 1024 * 1024) { // 10MB limit for image
          toast({
            title: "Error",
            description: "Image size must be less than 10MB.",
            variant: "destructive",
          });
          return;
        }
        setBulkMediaType('image');
      } else if (file.type.startsWith('video/')) {
        setBulkMediaType('video');
      } else {
        toast({
          title: "Error",
          description: "Please select an image or video file.",
          variant: "destructive",
        });
        return;
      }

      setBulkMediaFile(file);
      setBulkMediaPreview(URL.createObjectURL(file));
    }
  };

  const removeBulkMedia = () => {
    setBulkMediaFile(null);
    setBulkMediaPreview(null);
    setBulkMediaType(null);
    if (bulkFileInputRef.current) {
      bulkFileInputRef.current.value = '';
    }
  };

  const handleSendBulkMessage = async () => {
    if (!user?.uid) {
      toast({ title: "Error", description: "You must be logged in to send messages.", variant: "destructive" });
      return;
    }
    if (!bulkMessageContent.trim() && !bulkMediaFile) {
      toast({ title: "Error", description: "Message cannot be empty.", variant: "destructive" });
      return;
    }
    if (bulkIsPaid && (isNaN(bulkPrice) || bulkPrice <= 0)) {
      toast({ title: "Error", description: "Please enter a valid price for paid content.", variant: "destructive" });
      return;
    }

    setSendingBulkMessage(true);
    let mediaUrl: string | null = null;
    let mediaDuration: number | undefined = undefined;

    try {
      if (bulkMediaFile) {
        setUploadingBulkMedia(true);
        const folder = bulkMediaType === 'image' ? 'bulk-images' : 'bulk-videos';
        mediaUrl = await uploadToS3(bulkMediaFile, `${folder}/${user.uid}/${Date.now()}-${bulkMediaFile.name}`);

        if (bulkMediaType === 'video') {
          mediaDuration = 0; // Placeholder, actual duration would need more complex processing
        }
        setUploadingBulkMedia(false);
      }

      // Get all active subscribers for the current creator
      const subscriptionsQuery = query(
        collection(db, 'subscriptions'),
        where('creatorId', '==', user.uid),
        where('status', '==', 'active')
      );
      const subscriptionsSnapshot = await getDocs(subscriptionsQuery);

      if (subscriptionsSnapshot.empty) {
        toast({ title: "Info", description: "No active subscribers found to send the message to.", variant: "default" });
        setSendingBulkMessage(false);
        return;
      }

      const messagesBatch = writeBatch(db);
      let sentCount = 0;

      for (const subDoc of subscriptionsSnapshot.docs) {
        const subscriberId = subDoc.data().subscriberId;
        const chatId = [user.uid, subscriberId].sort().join('_');
        const chatRef = doc(db, 'chats', chatId);

        // Ensure chat document exists
        await setDoc(chatRef, {
          participants: [user.uid, subscriberId],
          lastMessage: bulkMessageContent.trim() || (bulkMediaType === 'image' ? '📷 Image' : bulkMediaType === 'video' ? '🎥 Video' : ''),
          lastMessageTime: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }, { merge: true });

        const messageData: any = {
          senderId: user.uid,
          receiverId: subscriberId,
          content: bulkMessageContent.trim(),
          timestamp: serverTimestamp(),
          read: false,
          type: bulkMediaType || 'text',
          senderName: user.displayName || user.email || 'Creator',
          senderPhotoURL: user.photoURL,
          locked: bulkIsPaid,
          price: bulkIsPaid ? bulkPrice : 0,
        };

        if (bulkMediaType === 'image' && mediaUrl) {
          messageData.imageUrl = mediaUrl;
        } else if (bulkMediaType === 'video' && mediaUrl) {
          messageData.videoUrl = mediaUrl;
          messageData.duration = mediaDuration;
        }

        messagesBatch.set(doc(db, 'chats', chatId, 'messages'), messageData);
        sentCount++;
      }

      await messagesBatch.commit();

      toast({
        title: "Success",
        description: `Message sent to ${sentCount} subscribers!`,
      });
      
      // Reset form
      setBulkMessageContent('');
      removeBulkMedia();
      setBulkIsPaid(false);
      setBulkPrice(0);
    } catch (error) {
      console.error('Error sending bulk message:', error);
      toast({
        title: "Error",
        description: "Failed to send bulk message. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSendingBulkMessage(false);
      setUploadingBulkMedia(false);
    }
  };

  const toggleSection = (section: keyof typeof openSections) => {
    setOpenSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const handleSave = async () => {
    if (!user?.uid) return;

    setSaving(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        welcomeMessage: welcomeMessage.trim(),
        welcomeImage: welcomeImage,
        updatedAt: new Date(),
      });

      toast({
        title: "Settings saved!",
        description: "Your welcome message has been updated successfully.",
      });
    } catch (error) {
      console.error('Error saving settings:', error);
      toast({
        title: "Error",
        description: "Failed to save settings. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
      <div className="max-w-4xl mx-auto space-y-2">
      {/* Bulk Message Section */}
      <Card>
        <CardHeader 
          className="cursor-pointer hover:bg-gray-50 transition-colors py-1"
          onClick={() => toggleSection('bulkMessage')}
        >
          <CardTitle className="flex items-center justify-between text-sm font-normal !font-normal">
            <div className="flex items-center gap-2">
              <Send className="h-3 w-3" />
              Bulk Message to Subscribers
            </div>
            <ChevronDown 
              className={`h-3 w-3 transition-transform ${
                openSections.bulkMessage ? 'rotate-180' : ''
              }`}
            />
          </CardTitle>
          <CardDescription className="text-xs text-gray-500">
            Send messages, images, or videos to all your active subscribers at once.
          </CardDescription>
        </CardHeader>
        {openSections.bulkMessage && (
          <CardContent className="py-6">
            <div className="space-y-4">
              {/* Message Content */}
              <div className="space-y-1">
                <Label htmlFor="bulk-message-content" className="text-xs font-normal">Message</Label>
                <Textarea
                  id="bulk-message-content"
                  placeholder=""
                  value={bulkMessageContent}
                  onChange={(e) => setBulkMessageContent(e.target.value)}
                  className="min-h-[100px] resize-none w-full"
                  maxLength={1000}
                  style={{
                    background: 'rgba(255, 255, 255, 0.9)',
                    border: '1px solid rgba(0, 0, 0, 0.1)',
                    borderRadius: '8px',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
                    fontSize: '14px',
                    padding: '12px 16px',
                  }}
                />
                <div className="text-sm text-gray-500 text-right">
                  {bulkMessageContent.length}/1000 characters
          </div>
        </div>

              {/* Media Upload */}
              <div className="space-y-1">
                <Label htmlFor="bulk-media-upload" className="text-xs font-normal">Media (Optional)</Label>
                {bulkMediaPreview ? (
                  <div className="relative w-full h-48 rounded-lg overflow-hidden border border-gray-200">
                    {bulkMediaType === 'image' ? (
                      <img src={bulkMediaPreview} alt="Media preview" className="w-full h-full object-cover" />
                    ) : (
                      <video src={bulkMediaPreview} controls className="w-full h-full object-cover" />
                    )}
                    <button
                      onClick={removeBulkMedia}
                      className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <div
                    onClick={() => bulkFileInputRef.current?.click()}
                    className="border-2 border-dashed border-gray-300 rounded-lg p-3 text-center cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-colors"
                  >
                    <Upload className="h-4 w-4 text-gray-400 mx-auto mb-1" />
                    <p className="text-xs text-gray-600">
                      Upload media
                    </p>
                  </div>
                )}
                <input
                  ref={bulkFileInputRef}
                  type="file"
                  accept="image/*,video/*"
                  onChange={handleBulkFileSelect}
                  className="hidden"
                />
                {uploadingBulkMedia && (
                  <div className="flex items-center justify-center py-3">
                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                    <span className="text-sm text-gray-600">Uploading media...</span>
                  </div>
                )}
          </div>

              {/* Free/Paid Toggle */}
              <div className="space-y-1">
                <Label className="text-xs font-normal">Message Type</Label>
                <div className="flex items-center space-x-3">
                  <label className="flex items-center space-x-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="bulk-message-type"
                      checked={!bulkIsPaid}
                      onChange={() => setBulkIsPaid(false)}
                      className="w-3 h-3 text-blue-600 border-gray-300 focus:ring-blue-500"
                    />
                    <span className="text-xs text-gray-700">Free</span>
                  </label>
                  <label className="flex items-center space-x-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="bulk-message-type"
                      checked={bulkIsPaid}
                      onChange={() => setBulkIsPaid(true)}
                      className="w-3 h-3 text-blue-600 border-gray-300 focus:ring-blue-500"
                    />
                    <span className="text-xs text-gray-700">Paid</span>
                  </label>
                </div>
                
                {bulkIsPaid && (
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <Label htmlFor="bulk-price" className="text-xs font-normal">Price:</Label>
                      <Input
                        id="bulk-price"
                        type="number"
                        placeholder="0.00"
                        value={bulkPrice}
                        onChange={(e) => setBulkPrice(Number(e.target.value))}
                        min="0.01"
                        step="0.01"
                        className="w-20"
                        style={{
                          background: 'rgba(255, 255, 255, 0.9)',
                          border: '1px solid rgba(0, 0, 0, 0.1)',
                          borderRadius: '6px',
                          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
                          fontSize: '12px',
                          padding: '6px 8px',
                        }}
                      />
                      <span className="text-xs text-gray-500">$</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Send Button */}
              <div className="flex justify-center">
                <button
                  onClick={handleSendBulkMessage}
                  disabled={sendingBulkMessage || uploadingBulkMedia}
                  className="bulk-send-btn"
                  style={{
                    border: 'none',
                    color: '#fff',
                    backgroundImage: 'linear-gradient(30deg, #3b82f6, #1d4ed8)',
                    backgroundColor: 'transparent',
                    borderRadius: '16px',
                    backgroundSize: '100% auto',
                    fontFamily: 'inherit',
                    fontSize: '10px',
                    padding: '4px 10px',
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
                    fontWeight: '600',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}
                >
                  {sendingBulkMessage ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  {sendingBulkMessage ? 'Sending...' : 'Send to All'}
                </button>
          </div>
        </div>
          </CardContent>
        )}
      </Card>

      {/* Welcome Message Section */}
      <Card>
        <CardHeader 
          className="cursor-pointer hover:bg-gray-50 transition-colors py-1"
          onClick={() => toggleSection('welcomeMessage')}
        >
          <CardTitle className="flex items-center justify-between text-sm font-normal !font-normal">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-3 w-3" />
              Welcome Message Settings
            </div>
            <ChevronDown 
              className={`h-3 w-3 transition-transform ${
                openSections.welcomeMessage ? 'rotate-180' : ''
              }`}
            />
          </CardTitle>
          <CardDescription className="text-xs text-gray-500">
            Set up an automatic welcome message that new subscribers will receive.
          </CardDescription>
        </CardHeader>
        {openSections.welcomeMessage && (
          <CardContent className="space-y-6 py-6">
          <div className="space-y-3">
            <Textarea
              id="welcome-message"
              placeholder=""
              value={welcomeMessage}
              onChange={(e) => setWelcomeMessage(e.target.value)}
              className="min-h-[120px] resize-none w-full"
              style={{
                background: 'rgba(255, 255, 255, 0.9)',
                border: '1px solid rgba(0, 0, 0, 0.1)',
                borderRadius: '8px',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
                fontSize: '14px',
                padding: '12px 16px',
              }}
              maxLength={500}
            />
            <div className="text-sm text-gray-500 text-right">
              {welcomeMessage.length}/500 characters
            </div>
          </div>

          {/* Image Upload Section */}
          <div className="space-y-1">
            <Label htmlFor="welcome-image" className="text-sm font-medium">Welcome Image (Optional)</Label>
            <div className="space-y-1">
              {welcomeImage ? (
                <div className="relative">
                  <img
                    src={welcomeImage}
                    alt="Welcome image preview"
                    className="w-full max-w-lg h-48 object-cover rounded-lg border border-gray-200"
                  />
                  <button
                    onClick={removeImage}
                    className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-gray-300 rounded-lg p-3 text-center cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-colors"
                  >
                    <Upload className="h-4 w-4 text-gray-400 mx-auto mb-1" />
                    <p className="text-xs text-gray-600">
                      Upload image
                    </p>
                  </div>
              )}
              
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />
              
                  {uploadingImage && (
                    <div className="flex items-center justify-center py-3">
                      <Loader2 className="h-5 w-5 animate-spin mr-2" />
                      <span className="text-sm text-gray-600">Uploading image...</span>
          </div>
                  )}
            </div>
          </div>

            <div className="flex justify-center">
              <button
                onClick={handleSave}
                disabled={saving}
                className="save-message-btn"
                style={{
                  border: 'none',
                  color: '#fff',
                  backgroundImage: 'linear-gradient(30deg, #3b82f6, #1d4ed8)',
                  backgroundColor: 'transparent',
                  borderRadius: '16px',
                  backgroundSize: '100% auto',
                  fontFamily: 'inherit',
                  fontSize: '10px',
                  padding: '4px 10px',
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
                  fontWeight: '600',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {saving ? 'Saving...' : 'Save Message'}
              </button>
        </div>
          </CardContent>
        )}
      </Card>


    </div>
  );
} 
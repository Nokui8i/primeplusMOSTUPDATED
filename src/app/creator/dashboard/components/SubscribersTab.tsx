'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { FiSearch, FiUserPlus, FiUserMinus, FiMail } from 'react-icons/fi';
import { useAuth } from '@/lib/firebase/auth';
import { db } from '@/lib/firebase/config';
import { collection, query, where, getDocs, orderBy, limit, Timestamp } from 'firebase/firestore';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { EmojiPicker } from '@/components/ui/emoji-picker';
import { Image as ImageIcon, Smile, X, Video } from 'lucide-react';
import { Chat } from '@/components/chat/Chat';
import { useRouter } from 'next/navigation';
import { useChat } from '@/contexts/ChatContext';
import { FullChatInput } from '@/components/chat/FullChatInput';
import { getAuth as getFirebaseAuth } from 'firebase/auth';
import { toast } from 'sonner';
import { BulkContentUpload } from './BulkContentUpload';

interface Subscriber {
  id: string;
  username: string;
  photoURL: string;
  subscribedAt: Date;
  status: 'active' | 'inactive';
  planType: 'Free' | 'Paid';
  planName: string;
}

export default function SubscribersTab() {
  const { user } = useAuth();
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const { openChat } = useChat();
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [bulkMessage, setBulkMessage] = useState('');
  const [bulkSending, setBulkSending] = useState(false);
  const [bulkImage, setBulkImage] = useState<File | null>(null);
  const [bulkImagePreview, setBulkImagePreview] = useState<string | null>(null);
  const [selectedSubscribers, setSelectedSubscribers] = useState<string[]>([]);
  const [planFilter, setPlanFilter] = useState<'All' | 'Paid' | 'Free'>('All');
  const [bulkVideo, setBulkVideo] = useState<File | null>(null);
  const [bulkVideoPreview, setBulkVideoPreview] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [voiceBlob, setVoiceBlob] = useState<Blob | null>(null);
  const [bulkLocked, setBulkLocked] = useState(false);

  useEffect(() => {
    const fetchSubscribers = async () => {
      if (!user?.uid) return;
      try {
        // Query the subscriptions collection for active subscriptions to this creator
        const subsRef = collection(db, 'subscriptions');
        const q = query(
          subsRef,
          where('creatorId', '==', user.uid),
          where('status', '==', 'active'),
          orderBy('createdAt', 'desc'),
          limit(50)
        );
        const querySnapshot = await getDocs(q);
        // For each subscription, fetch the user profile and plan
        const subscribersData: Subscriber[] = await Promise.all(
          querySnapshot.docs.map(async (doc) => {
            const sub = doc.data();
            // Fetch user profile
            const userSnap = await getDocs(query(collection(db, 'users'), where('uid', '==', sub.subscriberId)));
            let username = sub.subscriberId;
            let photoURL = '';
            if (!userSnap.empty) {
              const userData = userSnap.docs[0].data();
              username = userData.username || userData.displayName || sub.subscriberId;
              photoURL = userData.photoURL || '';
            } else {
              // Try fetching by document id as fallback
              try {
                const fallbackDoc = await getDocs(query(collection(db, 'users'), where('__name__', '==', sub.subscriberId)));
                if (!fallbackDoc.empty) {
                  const userData = fallbackDoc.docs[0].data();
                  username = userData.username || userData.displayName || sub.subscriberId;
                  photoURL = userData.photoURL || '';
                } else {
                  console.warn('[SubscribersTab] No user profile found for subscriber:', sub.subscriberId);
                }
              } catch (e) {
                console.error('[SubscribersTab] Error fetching fallback user profile:', sub.subscriberId, e);
              }
            }
            // Fetch plan info
            let planType: 'Free' | 'Paid' = 'Free';
            let planName = 'Free';
            if (sub.planId) {
              const planSnap = await getDocs(query(collection(db, 'plans'), where('id', '==', sub.planId)));
              if (!planSnap.empty) {
                const planData = planSnap.docs[0].data();
                planType = planData.price > 0 ? 'Paid' : 'Free';
                planName = planData.name || planType;
              }
            }
            return {
              id: doc.id,
              username,
              photoURL,
              subscribedAt: sub.createdAt?.toDate ? sub.createdAt.toDate() : new Date(),
              status: sub.status,
              planType,
              planName,
            };
          })
        );
        setSubscribers(subscribersData);
      } catch (error) {
        console.error('Error fetching subscribers:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchSubscribers();
  }, [user?.uid]);

  const filteredSubscribers = subscribers.filter(subscriber => {
    const matchesSearch = subscriber.username.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesPlan = planFilter === 'All' || subscriber.planType === planFilter;
    return matchesSearch && matchesPlan;
  });

  // Handle image selection for bulk
  const handleBulkImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setBulkImage(file);
      setBulkImagePreview(URL.createObjectURL(file));
    }
  };

  // Handle video selection for bulk
  const handleBulkVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setBulkVideo(file);
      setBulkVideoPreview(URL.createObjectURL(file));
    }
  };

  // Handle select all
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedSubscribers(filteredSubscribers.map(s => s.id));
    } else {
      setSelectedSubscribers([]);
    }
  };

  // Handle select one
  const handleSelectOne = (id: string, checked: boolean) => {
    setSelectedSubscribers(prev => checked ? [...prev, id] : prev.filter(sid => sid !== id));
  };

  // Handle emoji select
  const handleEmojiSelect = (emoji: string) => {
    setBulkMessage(prev => prev + emoji);
    setShowEmojiPicker(false);
  };

  // Handle voice recording (placeholder logic)
  const handleVoiceRecord = () => {
    setIsRecording(r => !r);
    // Implement actual recording logic as needed
  };

  const handleBulkMessageSend = async ({ text, images, videos, audio, type }: { 
    text: string, 
    images?: { file: File, locked: boolean }[], 
    videos?: { file: File, locked: boolean }[], 
    audio?: Blob, 
    type: "text" | "audio" | "video" | "image" 
  }) => {
    if (!user) return;
    setBulkSending(true);
    const subsRef = collection(db, 'subscriptions');
    const q = query(subsRef, where('creatorId', '==', user.uid), where('status', '==', 'active'));
    const querySnapshot = await getDocs(q);
    const firebaseAuth = getFirebaseAuth();
    const currentUser = firebaseAuth.currentUser;
    const idToken = currentUser ? await currentUser.getIdToken() : null;

    let successCount = 0;
    let failCount = 0;
    const errors: string[] = [];

    // Convert files to base64 strings with locked status
    const imagePromises = images?.map(({ file, locked }) => new Promise<{ base64: string, locked: boolean }>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve({ base64: reader.result as string, locked });
      reader.readAsDataURL(file);
    })) || [];

    const videoPromises = videos?.map(({ file, locked }) => new Promise<{ base64: string, locked: boolean }>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve({ base64: reader.result as string, locked });
      reader.readAsDataURL(file);
    })) || [];

    const audioPromise = audio ? new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(audio as Blob);
    }) : Promise.resolve('');

    const [imageObjs, videoObjs, audioString] = await Promise.all([
      Promise.all(imagePromises),
      Promise.all(videoPromises),
      audioPromise
    ]);

    for (const docSnap of querySnapshot.docs) {
      const sub = docSnap.data();
      if (!selectedSubscribers.includes(docSnap.id)) continue;

      // Fetch plan info for this subscriber
      let isPaid = false;
      if (sub.planId) {
        const planSnap = await getDocs(query(collection(db, 'plans'), where('id', '==', sub.planId)));
        if (!planSnap.empty) {
          const planData = planSnap.docs[0].data();
          isPaid = planData.price > 0;
        }
      }

      try {
        const response = await fetch('/api/send-bulk-message', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(idToken ? { 'Authorization': `Bearer ${idToken}` } : {})
          },
          body: JSON.stringify({
            to: sub.subscriberId,
            text,
            type,
            images: imageObjs,
            videos: videoObjs,
            audio: audioString && audioString !== '' ? [audioString] : [],
          })
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to send message');
        }

        successCount++;
      } catch (error: any) {
        failCount++;
        errors.push(`Failed to send to ${sub.subscriberId}: ${error.message}`);
        console.error('Error sending message:', error);
      }
    }

    setBulkSending(false);
    setBulkModalOpen(false);
    setSelectedSubscribers([]);

    // Show results to user
    if (successCount > 0) {
      toast.success(`Successfully sent to ${successCount} subscriber${successCount !== 1 ? 's' : ''}`);
    }
    if (failCount > 0) {
      toast.error(`Failed to send to ${failCount} subscriber${failCount !== 1 ? 's' : ''}`);
      console.error('Failed messages:', errors);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="relative">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <Input
              type="text"
              placeholder="Search subscribers..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <select
            className="ml-2 border border-gray-300 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-200 bg-white text-black"
            value={planFilter}
            onChange={e => setPlanFilter(e.target.value as 'All' | 'Paid' | 'Free')}
            aria-label="Filter by plan"
          >
            <option value="All">All Plans</option>
            <option value="Paid">Paid</option>
            <option value="Free">Free</option>
          </select>
        </div>
        <div className="flex items-center space-x-2">
          <button
            className="flex items-center space-x-2 bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600"
            onClick={() => setBulkModalOpen(true)}
          >
            <FiMail />
            <span>Message All</span>
          </button>
        </div>
      </div>

      {/* Subscribers List */}
      <Card className="p-3 bg-white border border-gray-200 shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-xs">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-1 py-1 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  <input
                    type="checkbox"
                    checked={selectedSubscribers.length === filteredSubscribers.length && filteredSubscribers.length > 0}
                    onChange={e => handleSelectAll(e.target.checked)}
                    className="accent-blue-500"
                  />
                </th>
                <th className="px-2 py-1 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Name</th>
                <th className="px-2 py-1 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Plan</th>
                <th className="px-2 py-1 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Subscribed</th>
                <th className="px-2 py-1 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {isLoading ? (
                <tr>
                  <td colSpan={4} className="py-4 text-center">
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div>
                    </div>
                  </td>
                </tr>
              ) : filteredSubscribers.length > 0 ? (
                filteredSubscribers.map((subscriber) => (
                  <tr key={subscriber.id} className="hover:bg-gray-50 transition">
                    <td className="px-1 py-1">
                      <input
                        type="checkbox"
                        checked={selectedSubscribers.includes(subscriber.id)}
                        onChange={e => handleSelectOne(subscriber.id, e.target.checked)}
                        className="accent-blue-500"
                      />
                    </td>
                    <td className="px-2 py-1 whitespace-nowrap flex items-center gap-2">
                      <img
                        src={subscriber.photoURL}
                        alt={subscriber.username}
                        className="w-6 h-6 rounded-full border border-gray-200 shadow-sm"
                      />
                      <span className="font-semibold text-gray-900 text-[12px]">{subscriber.username}</span>
                    </td>
                    <td className="px-2 py-1 whitespace-nowrap">
                      <span className={`px-1 py-0.5 rounded-full text-xs font-semibold ${subscriber.planType === 'Paid' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'} shadow-sm border border-gray-200`}>
                        {subscriber.planName}
                      </span>
                    </td>
                    <td className="px-2 py-1 whitespace-nowrap text-xs text-gray-500">
                      {subscriber.subscribedAt.toLocaleDateString()}
                    </td>
                    <td className="px-2 py-1 whitespace-nowrap flex items-center gap-1">
                      <button
                        className="p-1 text-gray-500 hover:text-blue-600 transition"
                        onClick={() => openChat({
                          id: subscriber.id,
                          uid: subscriber.id,
                          displayName: subscriber.username,
                          username: subscriber.username,
                          photoURL: subscriber.photoURL,
                          email: '',
                          isAgeVerified: false,
                          isVerified: false,
                          role: 'user',
                          status: 'active',
                          createdAt: Timestamp.now(),
                          updatedAt: Timestamp.now(),
                        })}
                      >
                        <FiMail size={14} />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="py-4 text-center text-gray-400">
                    No subscribers found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Bulk Message Modal */}
      <Dialog open={bulkModalOpen} onOpenChange={setBulkModalOpen}>
        <DialogContent className="max-w-md rounded-2xl p-6 bg-white shadow-xl border border-gray-100">
          <div className="mt-2 space-y-2">
            <BulkContentUpload
              onSend={async ({ text, media }) => {
                // Split media into images/videos arrays for backend
                const images = media.filter(m => m.type === 'image').map(({ file, locked, price }) => ({ file, locked, price }));
                const videos = media.filter(m => m.type === 'video').map(({ file, locked, price }) => ({ file, locked, price }));
                await handleBulkMessageSend({ text, images, videos, type: media.length > 0 ? media[0].type : 'text' });
              }}
              onCancel={() => setBulkModalOpen(false)}
              uploading={bulkSending}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
} 
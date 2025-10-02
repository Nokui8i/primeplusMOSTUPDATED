import { getDatabase, ref, onValue, set, remove } from 'firebase/database';
import { app } from '@/lib/firebase/config';

interface SignalingData {
  type: 'offer' | 'answer' | 'ice-candidate';
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
  from: string;
  to: string;
}

export class SignalingServer {
  private streamId: string;
  private userId: string;
  private db = getDatabase(app);

  constructor(streamId: string, userId: string) {
    this.streamId = streamId;
    this.userId = userId;
  }

  // Create signaling channel for a stream
  async createSignalingChannel() {
    const channelRef = ref(this.db, `signaling/${this.streamId}`);
    await set(channelRef, {
      created: Date.now(),
      owner: this.userId,
      active: true
    });
    return channelRef;
  }

  // Listen for incoming signaling messages
  onSignalingMessage(callback: (data: SignalingData) => void) {
    const messagesRef = ref(this.db, `signaling/${this.streamId}/messages`);
    return onValue(messagesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        Object.values(data).forEach((message: any) => {
          if (message.to === this.userId) {
            callback(message as SignalingData);
          }
        });
      }
    });
  }

  // Send signaling message
  async sendSignalingMessage(data: Omit<SignalingData, 'from'>) {
    const messageRef = ref(this.db, `signaling/${this.streamId}/messages/${Date.now()}`);
    await set(messageRef, {
      ...data,
      from: this.userId,
      timestamp: Date.now()
    });
  }

  // Clean up signaling channel
  async cleanup() {
    const channelRef = ref(this.db, `signaling/${this.streamId}`);
    await remove(channelRef);
  }
} 
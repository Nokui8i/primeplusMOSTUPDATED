import { doc, collection, addDoc, updateDoc, deleteDoc, query, where, getDocs, Timestamp, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from 'sonner';

interface ScheduledStream {
  id: string;
  userId: string;
  title: string;
  description: string;
  scheduledFor: Date;
  duration: number; // in minutes
  isPublic: boolean;
  quality: '4k' | '2k' | '1080p' | '720p' | '480p' | 'auto';
  thumbnail?: string;
  status: 'scheduled' | 'live' | 'ended' | 'cancelled';
  createdAt: Date;
  updatedAt: Date;
}

interface ScheduleNotification {
  type: 'reminder' | 'start' | 'cancelled';
  streamId: string;
  userId: string;
  scheduledFor: Date;
  message: string;
}

export class StreamScheduleManager {
  private userId: string;

  constructor(userId: string) {
    this.userId = userId;
  }

  async scheduleStream(streamData: Omit<ScheduledStream, 'id' | 'userId' | 'status' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      const streamRef = await addDoc(collection(db, 'scheduled_streams'), {
        ...streamData,
        userId: this.userId,
        status: 'scheduled',
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      });

      // Schedule notifications
      await this.scheduleNotifications(streamRef.id, streamData.scheduledFor);

      toast.success('Stream scheduled successfully!');
      return streamRef.id;
    } catch (error) {
      console.error('Error scheduling stream:', error);
      toast.error('Failed to schedule stream');
      throw error;
    }
  }

  async updateSchedule(streamId: string, updates: Partial<ScheduledStream>): Promise<void> {
    try {
      const streamRef = doc(db, 'scheduled_streams', streamId);
      await updateDoc(streamRef, {
        ...updates,
        updatedAt: Timestamp.now()
      });

      // Reschedule notifications if time changed
      if (updates.scheduledFor) {
        await this.scheduleNotifications(streamId, updates.scheduledFor);
      }

      toast.success('Stream schedule updated!');
    } catch (error) {
      console.error('Error updating stream schedule:', error);
      toast.error('Failed to update stream schedule');
      throw error;
    }
  }

  async cancelSchedule(streamId: string): Promise<void> {
    try {
      const streamRef = doc(db, 'scheduled_streams', streamId);
      await updateDoc(streamRef, {
        status: 'cancelled',
        updatedAt: Timestamp.now()
      });

      // Cancel notifications
      await this.cancelNotifications(streamId);

      toast.success('Stream cancelled successfully');
    } catch (error) {
      console.error('Error cancelling stream:', error);
      toast.error('Failed to cancel stream');
      throw error;
    }
  }

  async getScheduledStreams(status?: ScheduledStream['status']): Promise<ScheduledStream[]> {
    try {
      let q = query(
        collection(db, 'scheduled_streams'),
        where('userId', '==', this.userId)
      );

      if (status) {
        q = query(q, where('status', '==', status));
      }

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as ScheduledStream));
    } catch (error) {
      console.error('Error fetching scheduled streams:', error);
      toast.error('Failed to fetch scheduled streams');
      throw error;
    }
  }

  private async scheduleNotifications(streamId: string, scheduledFor: Date): Promise<void> {
    try {
      // Schedule reminder 1 hour before
      const reminderTime = new Date(scheduledFor.getTime() - 60 * 60 * 1000);
      await addDoc(collection(db, 'notifications'), {
        type: 'reminder',
        streamId,
        userId: this.userId,
        scheduledFor: reminderTime,
        message: 'Your stream starts in 1 hour!',
        createdAt: Timestamp.now()
      });

      // Schedule start notification
      await addDoc(collection(db, 'notifications'), {
        type: 'start',
        streamId,
        userId: this.userId,
        scheduledFor,
        message: 'Your stream is starting now!',
        createdAt: Timestamp.now()
      });
    } catch (error) {
      console.error('Error scheduling notifications:', error);
      throw error;
    }
  }

  private async cancelNotifications(streamId: string): Promise<void> {
    try {
      const notificationsRef = collection(db, 'notifications');
      const q = query(
        notificationsRef,
        where('streamId', '==', streamId),
        where('userId', '==', this.userId)
      );

      const snapshot = await getDocs(q);
      const batch = writeBatch(db);

      snapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });

      await batch.commit();
    } catch (error) {
      console.error('Error cancelling notifications:', error);
      throw error;
    }
  }
} 
import { getDatabase, ref, onValue, set, remove, push, serverTimestamp } from 'firebase/database';
import { app } from '@/lib/firebase/config';
import { doc, updateDoc, increment } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface StreamState {
  isLive: boolean;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  quality: '1080p' | '720p' | '480p';
}

interface StreamCallbacks {
  onStateChange?: (state: StreamState) => void;
  onError?: (error: Error) => void;
}

interface StreamMetadata {
  title: string;
  description: string;
  userId: string;
  username: string;
  startedAt: number;
  endedAt?: number;
  status: 'live' | 'ended';
  viewerCount: number;
  thumbnail?: string | null;
}

interface StreamChunk {
  timestamp: number;
  data: string; // Base64 encoded video data
  duration: number;
}

export class StreamingClient {
  private db = getDatabase(app);
  private peerConnection: RTCPeerConnection | null = null;
  private streamId: string;
  private userId: string;
  private isBroadcaster: boolean;
  private callbacks: StreamCallbacks;
  private state: StreamState = {
    isLive: true,
    currentTime: 0,
    duration: 0,
    isPlaying: true,
    quality: '720p',
  };
  private mediaRecorder: MediaRecorder | null = null;
  private chunks: StreamChunk[] = [];
  private bufferSize = 4 * 60 * 60; // 4 hours in seconds

  constructor(
    streamId: string,
    userId: string,
    isBroadcaster: boolean,
    callbacks: StreamCallbacks = {}
  ) {
    this.streamId = streamId;
    this.userId = userId;
    this.isBroadcaster = isBroadcaster;
    this.callbacks = callbacks;
  }

  async connect() {
    try {
      this.initializePeerConnection();
      this.setupStreamListeners();

      // Update viewer count in post
      if (!this.isBroadcaster) {
        const postRef = doc(db, 'posts', this.streamId);
        await updateDoc(postRef, {
          viewerCount: increment(1)
        });
      }
    } catch (error) {
      this.callbacks.onError?.(error as Error);
    }
  }

  private initializePeerConnection() {
    this.peerConnection = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
      iceCandidatePoolSize: 10,
    });

    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendStreamEvent('ice-candidate', { candidate: event.candidate });
      }
    };

    this.peerConnection.oniceconnectionstatechange = () => {
      console.log('ICE connection state:', this.peerConnection?.iceConnectionState);
      if (this.peerConnection?.iceConnectionState === 'failed') {
        this.peerConnection.restartIce();
      }
    };

    this.peerConnection.onsignalingstatechange = () => {
      console.log('Signaling state:', this.peerConnection?.signalingState);
    };

    this.peerConnection.ontrack = (event) => {
      if (!this.isBroadcaster && event.streams[0]) {
        this.updateState({ isLive: true });
      }
    };
  }

  private setupStreamListeners() {
    // Listen for stream events
    const streamRef = ref(this.db, `streams/${this.streamId}/events`);
    onValue(streamRef, (snapshot) => {
      const events = snapshot.val();
      if (events) {
        Object.entries(events).forEach(([key, event]: [string, any]) => {
          this.handleStreamEvent(event);
          // Remove the event after handling to prevent re-processing
          remove(ref(this.db, `streams/${this.streamId}/events/${key}`));
        });
      }
    });

    // Listen for stream chunks
    const chunksRef = ref(this.db, `streams/${this.streamId}/chunks`);
    onValue(chunksRef, (snapshot) => {
      const chunks = snapshot.val();
      if (chunks) {
        this.chunks = Object.values(chunks) as StreamChunk[];
        this.updateState({
          duration: this.chunks.reduce((acc, chunk) => acc + chunk.duration, 0),
        });
      }
    });
  }

  private async handleStreamEvent(event: any) {
    switch (event.type) {
      case 'offer':
        if (!this.isBroadcaster) {
          await this.handleOffer(event.sdp);
        }
        break;

      case 'answer':
        if (this.isBroadcaster) {
          await this.handleAnswer(event.sdp);
        }
        break;

      case 'ice-candidate':
        await this.handleIceCandidate(event.candidate);
        break;

      case 'stream-state':
        this.updateState({
          currentTime: event.currentTime,
          isLive: event.isLive,
        });
        break;
    }
  }

  private async handleIceCandidate(candidate: RTCIceCandidateInit | undefined) {
    if (!this.peerConnection || !candidate) return;
    
    try {
      // Only add candidate if it has all required fields and we're in a valid state
      if (candidate.candidate && 
          candidate.sdpMid != null && 
          candidate.sdpMLineIndex != null &&
          this.peerConnection.remoteDescription) {
        await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      }
    } catch (err) {
      console.error('Failed to add ICE candidate:', err);
      this.callbacks.onError?.(new Error('Failed to establish peer connection'));
    }
  }

  private async handleOffer(sdp: RTCSessionDescriptionInit) {
    if (!this.peerConnection) return;
    try {
      // Only handle offer if in 'stable' state
      if (this.peerConnection.signalingState !== 'stable') {
        console.warn('Cannot handle offer in current state:', this.peerConnection.signalingState);
        return;
      }

      // Set remote offer
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));

      // Double-check state before creating answer
      if ((this.peerConnection.signalingState as any) !== 'have-remote-offer') {
        console.warn('Not in have-remote-offer state after setting remote offer:', this.peerConnection.signalingState);
        return;
      }

      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);
      this.sendStreamEvent('answer', { sdp: answer });
    } catch (err) {
      console.error('Error handling offer:', err);
      this.callbacks.onError?.(err as Error);
    }
  }

  private async handleAnswer(sdp: RTCSessionDescriptionInit) {
    if (!this.peerConnection) return;
    try {
      // Check if we're in a state where we can handle an answer
      if (this.peerConnection.signalingState !== 'have-local-offer') {
        console.warn('Cannot handle answer in current state:', this.peerConnection.signalingState);
        return;
      }

      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));
    } catch (err) {
      console.error('Failed to handle answer:', err);
      this.callbacks.onError?.(new Error('Failed to establish peer connection'));
    }
  }

  async startBroadcasting(stream: MediaStream, metadata: Omit<StreamMetadata, 'status' | 'viewerCount' | 'endedAt'>) {
    if (!this.isBroadcaster || !this.peerConnection) return;

    // Create stream metadata
    const streamRef = ref(this.db, `streams/${this.streamId}`);
    await set(streamRef, {
      ...metadata,
      status: 'live',
      viewerCount: 0,
      startedAt: serverTimestamp(),
    });

    // Set up media recorder for buffering
    this.mediaRecorder = new MediaRecorder(stream, {
      mimeType: 'video/webm;codecs=vp8,opus',
    });

    this.mediaRecorder.ondataavailable = async (event) => {
      if (event.data.size > 0) {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64data = reader.result as string;
          this.saveStreamChunk(base64data, event.data.size);
        };
        reader.readAsDataURL(event.data);
      }
    };

    // Start recording in 10-second chunks
    this.mediaRecorder.start(10000);

    // Add tracks to peer connection
    stream.getTracks().forEach((track) => {
      this.peerConnection?.addTrack(track, stream);
    });

    // Create and send offer
    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);
    this.sendStreamEvent('offer', { sdp: offer });
  }

  private async saveStreamChunk(data: string, size: number) {
    const chunkRef = push(ref(this.db, `streams/${this.streamId}/chunks`));
    await set(chunkRef, {
      timestamp: serverTimestamp(),
      data,
      duration: 10, // 10 seconds per chunk
      size,
    });

    // Clean up old chunks
    this.cleanupOldChunks();
  }

  private async cleanupOldChunks() {
    const chunksRef = ref(this.db, `streams/${this.streamId}/chunks`);
    const snapshot = await onValue(chunksRef, (snapshot) => {
      const chunks = snapshot.val();
      if (chunks) {
        const chunkEntries = Object.entries(chunks) as [string, StreamChunk][];
        const totalDuration = chunkEntries.reduce((acc, [_, chunk]) => acc + chunk.duration, 0);
        
        if (totalDuration > this.bufferSize) {
          // Remove oldest chunks until we're under the buffer size
          let currentDuration = totalDuration;
          for (const [key, chunk] of chunkEntries) {
            if (currentDuration <= this.bufferSize) break;
            remove(ref(this.db, `streams/${this.streamId}/chunks/${key}`));
            currentDuration -= chunk.duration;
          }
        }
      }
    });
  }

  async endStream() {
    if (!this.isBroadcaster) return;

    const streamRef = ref(this.db, `streams/${this.streamId}`);
    await set(streamRef, {
      status: 'ended',
      endedAt: serverTimestamp(),
    });

    // Update post status
    const postRef = doc(db, 'posts', this.streamId);
    await updateDoc(postRef, {
      status: 'ended',
      updatedAt: serverTimestamp()
    });

    this.cleanup();
  }

  async seek(time: number) {
    if (this.isBroadcaster) return;
    this.sendStreamEvent('seek', { time });
  }

  async setPlaybackRate(rate: number) {
    if (this.isBroadcaster) return;
    this.sendStreamEvent('playback-rate', { rate });
  }

  async togglePlay() {
    if (this.isBroadcaster) return;
    this.updateState({ isPlaying: !this.state.isPlaying });
    this.sendStreamEvent('playback-state', { isPlaying: this.state.isPlaying });
  }

  async goLive() {
    if (this.isBroadcaster) return;
    this.sendStreamEvent('go-live');
  }

  async setQuality(quality: '1080p' | '720p' | '480p') {
    this.updateState({ quality });
    this.sendStreamEvent('quality-change', { quality });
  }

  private updateState(newState: Partial<StreamState>) {
    this.state = { ...this.state, ...newState };
    this.callbacks.onStateChange?.(this.state);
  }

  private sendStreamEvent(type: string, data: any = {}) {
    const eventRef = push(ref(this.db, `streams/${this.streamId}/events`));
    set(eventRef, {
      type,
      ...data,
      timestamp: serverTimestamp(),
      userId: this.userId,
    });
  }

  cleanup() {
    this.mediaRecorder?.stop();
    this.peerConnection?.close();
    this.peerConnection = null;
    this.mediaRecorder = null;

    // Decrement viewer count in post
    if (!this.isBroadcaster) {
      const postRef = doc(db, 'posts', this.streamId);
      updateDoc(postRef, {
        viewerCount: increment(-1)
      }).catch(console.error);
    }
  }
} 
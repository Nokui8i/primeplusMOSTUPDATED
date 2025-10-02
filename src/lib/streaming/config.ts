import { AccessToken } from 'livekit-server-sdk';

export const LIVEKIT_URL = process.env.NEXT_PUBLIC_LIVEKIT_URL || '';
export const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY || '';
export const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET || '';

// This function will only be used on the server
export async function generateLiveKitToken(roomName: string, participantName: string, isHost: boolean = false) {
  // Use dynamic import to avoid node:crypto issues during build
  if (typeof window === 'undefined') {
    try {
      // Server-side token generation
      const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
        identity: participantName,
      });
  
      at.addGrant({
        room: roomName,
        roomJoin: true,
        canPublish: isHost,
        canSubscribe: true,
      });
  
      return at.toJwt();
    } catch (error) {
      console.error('Error generating LiveKit token:', error);
      throw error;
    }
  } else {
    // Client-side: Make API call to generate token
    try {
      const response = await fetch(`/api/livekit/token?room=${roomName}&identity=${participantName}&isHost=${isHost}`);
      if (!response.ok) {
        throw new Error('Failed to generate token');
      }
      const data = await response.json();
      return data.token;
    } catch (error) {
      console.error('Error generating LiveKit token:', error);
      throw error;
    }
  }
}

export const STREAMING_CONFIG = {
  // Ant Media Server WebSocket URL
  wsUrl: process.env.NEXT_PUBLIC_ANT_MEDIA_WS_URL || 'ws://localhost:5080/WebRTCAppEE/websocket',
  // Ant Media Server REST API URL
  restUrl: process.env.NEXT_PUBLIC_ANT_MEDIA_REST_URL || 'http://localhost:5080/WebRTCAppEE/rest/v2',
  // Stream buffer duration in seconds (4 hours)
  bufferDuration: 4 * 60 * 60,
  // Stream quality presets
  qualityPresets: {
    '1080p': {
      width: 1920,
      height: 1080,
      bitrate: 4000000, // 4 Mbps
    },
    '720p': {
      width: 1280,
      height: 720,
      bitrate: 2500000, // 2.5 Mbps
    },
    '480p': {
      width: 854,
      height: 480,
      bitrate: 1000000, // 1 Mbps
    },
  },
} as const; 
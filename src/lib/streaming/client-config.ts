// This is a client-side only configuration for LiveKit
export const LIVEKIT_URL = process.env.NEXT_PUBLIC_LIVEKIT_URL || '';

// Client-side function to request a token from the server
export async function getLiveKitToken(roomName: string, participantIdentity: string, isHost: boolean = false): Promise<string> {
  try {
    const response = await fetch(`/api/livekit/token?room=${encodeURIComponent(roomName)}&identity=${encodeURIComponent(participantIdentity)}&isHost=${isHost}`);
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to generate token');
    }
    
    const data = await response.json();
    return data.token;
  } catch (error) {
    console.error('Error getting LiveKit token:', error);
    throw error;
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
"use client";

import { useEffect, useState, useRef } from "react";
import {
  LiveKitRoom,
  GridLayout,
  ParticipantTile,
  RoomAudioRenderer,
  ControlBar,
  useTracks,
  useLocalParticipant,
} from "@livekit/components-react";
import { Track, Room } from "livekit-client";
import { useAuth } from "@/hooks/useAuth";
import { getLiveKitToken, LIVEKIT_URL } from "@/lib/streaming/client-config";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Video, VideoOff, VolumeX, Volume2, User } from "lucide-react";

interface LiveKitStreamProps {
  roomName: string;
  isHost: boolean;
}

export default function LiveKitStream({ roomName, isHost = false }: LiveKitStreamProps) {
  const { user } = useAuth();
  const [token, setToken] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);

  useEffect(() => {
    async function fetchToken() {
      if (!user) return;
      
      try {
        setIsLoading(true);
        const generatedToken = await getLiveKitToken(roomName, user.uid, isHost);
        setToken(generatedToken);
        setError(null);
      } catch (err) {
        console.error('Error generating token:', err);
        setError('Failed to generate streaming token');
      } finally {
        setIsLoading(false);
      }
    }

    fetchToken();
  }, [user, roomName, isHost]);

  useEffect(() => {
    if (!isHost) return;
    // Check for camera devices on mount
    navigator.mediaDevices.enumerateDevices().then(devices => {
      const hasCamera = devices.some(device => device.kind === 'videoinput');
      if (!hasCamera) {
        setIsVideoOff(true);
      }
    });
  }, [isHost]);

  const openStreamPopup = () => {
    const popup = window.open(`/stream/${roomName}`, 'LiveStream', 'width=800,height=600');
    if (popup) {
      popup.focus();
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center w-full h-full min-h-[400px] bg-gray-900">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center w-full h-full min-h-[400px] bg-gray-900 text-white">
        <div className="text-center">
          <p className="mb-4">{error}</p>
          <Button onClick={() => window.location.reload()}>Retry</Button>
        </div>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="flex items-center justify-center w-full h-full min-h-[400px] bg-gray-900 text-white">
        <p>Please sign in to join the stream</p>
      </div>
    );
  }

  return (
    <LiveKitRoom
      token={token}
      serverUrl={LIVEKIT_URL}
      connect={true}
      video={isHost && !isVideoOff}
      audio={isHost}
      data-lk-theme="default"
      style={{ width: "100%", height: "100%" }}
    >
      <StreamContent isHost={isHost} isVideoOff={isVideoOff} setIsVideoOff={setIsVideoOff} />
      <RoomAudioRenderer muted={!isHost && isAudioMuted} />
      {!isHost && (
        <Button onClick={openStreamPopup} className="mt-4">
          Open Stream in Popup
        </Button>
      )}
    </LiveKitRoom>
  );
}

interface StreamContentProps {
  isHost: boolean;
  isVideoOff: boolean;
  setIsVideoOff: (off: boolean) => void;
}

function SoundBarVisualizer({ stream }: { stream: MediaStream | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

  useEffect(() => {
    if (!stream) return;
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 32;
    const source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);
    audioContextRef.current = audioContext;
    analyserRef.current = analyser;
    sourceRef.current = source;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    function draw() {
      if (!ctx || !canvas) return;
      analyser.getByteFrequencyData(dataArray);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const barWidth = (canvas.width / bufferLength) * 1.5;
      let x = 0;
      for (let i = 0; i < bufferLength; i++) {
        const barHeight = dataArray[i] / 2;
        ctx.fillStyle = '#4f46e5';
        ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
        x += barWidth + 2;
      }
      animationRef.current = requestAnimationFrame(draw);
    }
    draw();
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      analyser.disconnect();
      source.disconnect();
      audioContext.close();
    };
  }, [stream]);

  return <canvas ref={canvasRef} width={120} height={40} className="mt-4" />;
}

function StreamContent({ isHost, isVideoOff, setIsVideoOff }: StreamContentProps) {
  const tracks = useTracks([
    { source: Track.Source.Camera, withPlaceholder: true },
    { source: Track.Source.ScreenShare, withPlaceholder: true },
    { source: Track.Source.Microphone, withPlaceholder: true },
  ]);
  const { localParticipant } = useLocalParticipant();
  const hasTracks = tracks.length > 0;
  const [isMuted, setIsMuted] = useState(false);
  const [micStream, setMicStream] = useState<MediaStream | null>(null);
  const [remoteMicStream, setRemoteMicStream] = useState<MediaStream | null>(null);

  // Custom mic toggle
  const handleMicToggle = async () => {
    if (!localParticipant) return;
    const newMute = !isMuted;
    await localParticipant.setMicrophoneEnabled(!newMute);
    setIsMuted(newMute);
  };

  // Custom camera toggle
  const handleVideoToggle = async () => {
    if (!localParticipant) return;
    const newVideo = !isVideoOff;
    await localParticipant.setCameraEnabled(!newVideo);
    setIsVideoOff(newVideo);
  };

  // Get the local audio stream for the visualizer (host)
  useEffect(() => {
    if (!isHost) return;
    if (!isVideoOff) {
      setMicStream(null);
      return;
    }
    navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      .then(stream => setMicStream(stream))
      .catch(() => setMicStream(null));
  }, [isHost, isVideoOff]);

  // Get the remote audio stream for the visualizer (watcher)
  useEffect(() => {
    if (isHost) return;
    if (!isVideoOff) {
      setRemoteMicStream(null);
      return;
    }
    // Find the remote audio track
    const audioTrack = tracks.find(t => t.source === Track.Source.Microphone && t.participant && !t.participant.isLocal);
    if (audioTrack && audioTrack.publication && audioTrack.publication.track) {
      const mediaStream = new MediaStream([audioTrack.publication.track.mediaStreamTrack]);
      setRemoteMicStream(mediaStream);
    } else {
      setRemoteMicStream(null);
    }
  }, [isHost, isVideoOff, tracks]);

  return (
    <div className="relative w-full h-full flex items-center justify-center">
      {hasTracks && !isVideoOff ? (
        <GridLayout tracks={tracks} style={{ width: '100%', height: '100%' }}>
          <></>
        </GridLayout>
      ) : (
        <div className="flex flex-col items-center justify-center w-full h-full">
          <User className="w-32 h-32 text-gray-700" />
          {/* Sound bar visualizer for mic-only (host or watcher) */}
          {isHost && isVideoOff && micStream && !isMuted && <SoundBarVisualizer stream={micStream} />}
          {!isHost && isVideoOff && remoteMicStream && <SoundBarVisualizer stream={remoteMicStream} />}
        </div>
      )}
      {isHost && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-4 bg-black/60 rounded-xl px-4 py-2 shadow-lg">
          <button
            onClick={handleMicToggle}
            className={`p-2 rounded-full transition-colors ${isMuted ? 'bg-red-600 text-white' : 'bg-gray-800 text-white hover:bg-gray-700'}`}
            aria-label={isMuted ? 'Unmute microphone' : 'Mute microphone'}
          >
            {isMuted ? <MicOff size={18} /> : <Mic size={18} />}
          </button>
          <button
            onClick={handleVideoToggle}
            className={`p-2 rounded-full transition-colors ${isVideoOff ? 'bg-red-600 text-white' : 'bg-gray-800 text-white hover:bg-gray-700'}`}
            aria-label={isVideoOff ? 'Turn camera on' : 'Turn camera off'}
          >
            {isVideoOff ? <VideoOff size={18} /> : <Video size={18} />}
          </button>
        </div>
      )}
    </div>
  );
} 
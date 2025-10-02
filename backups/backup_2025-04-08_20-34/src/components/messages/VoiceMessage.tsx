import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { FiMic, FiPlay, FiPause, FiTrash2, FiSend } from 'react-icons/fi';
import { messagesService } from '@/lib/services/messages';
import { useToast } from '@/hooks/use-toast';

interface VoiceMessageProps {
  threadId: string;
  onSend: () => void;
}

export function VoiceMessage({ threadId, onSend }: VoiceMessageProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [waveform, setWaveform] = useState<number[]>([]);
  
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);
  const audioElement = useRef<HTMLAudioElement | null>(null);
  const recordingInterval = useRef<NodeJS.Timeout>();
  const { toast } = useToast();

  useEffect(() => {
    return () => {
      if (recordingInterval.current) {
        clearInterval(recordingInterval.current);
      }
      if (mediaRecorder.current && isRecording) {
        mediaRecorder.current.stop();
      }
    };
  }, [isRecording]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder.current = new MediaRecorder(stream);
      audioChunks.current = [];
      setWaveform([]);

      mediaRecorder.current.ondataavailable = (event) => {
        audioChunks.current.push(event.data);
      };

      mediaRecorder.current.onstop = () => {
        const audioBlob = new Blob(audioChunks.current, { type: 'audio/webm' });
        setAudioBlob(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.current.start();
      setIsRecording(true);
      setRecordingTime(0);
      
      recordingInterval.current = setInterval(() => {
        setRecordingTime(time => {
          if (time >= 300) { // 5 minutes max
            stopRecording();
            return time;
          }
          return time + 1;
        });
        
        // Simulate waveform data
        setWaveform(current => [...current, Math.random() * 100]);
      }, 1000);
    } catch (error) {
      toast({
        title: 'Microphone access denied',
        description: 'Please allow microphone access to record voice messages.',
        variant: 'destructive',
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorder.current && isRecording) {
      mediaRecorder.current.stop();
      setIsRecording(false);
      if (recordingInterval.current) {
        clearInterval(recordingInterval.current);
      }
    }
  };

  const playPauseAudio = () => {
    if (!audioElement.current || !audioBlob) return;

    if (isPlaying) {
      audioElement.current.pause();
    } else {
      audioElement.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleSend = async () => {
    if (!audioBlob) return;

    try {
      await messagesService.sendVoiceMessage(
        threadId,
        audioBlob,
        recordingTime,
        waveform
      );
      
      setAudioBlob(null);
      setRecordingTime(0);
      setWaveform([]);
      onSend();
      
      toast({
        title: 'Voice message sent',
        description: 'Your voice message has been sent successfully.',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to send voice message. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col gap-2 p-4 border rounded-lg bg-background">
      {audioBlob ? (
        <>
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={playPauseAudio}
            >
              {isPlaying ? <FiPause /> : <FiPlay />}
            </Button>
            
            <div className="flex-1">
              <div className="flex gap-2 items-center">
                {waveform.map((value, index) => (
                  <div
                    key={index}
                    className="w-1 bg-primary"
                    style={{ height: `${value / 2}px` }}
                  />
                ))}
              </div>
              <Slider
                value={[currentTime]}
                max={recordingTime}
                step={1}
                onValueChange={([value]) => {
                  if (audioElement.current) {
                    audioElement.current.currentTime = value;
                    setCurrentTime(value);
                  }
                }}
              />
            </div>
            
            <span className="text-sm text-muted-foreground">
              {formatTime(currentTime)}/{formatTime(recordingTime)}
            </span>
          </div>
          
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => {
                setAudioBlob(null);
                setRecordingTime(0);
                setWaveform([]);
              }}
            >
              <FiTrash2 />
            </Button>
            <Button onClick={handleSend}>
              <FiSend className="mr-2" />
              Send
            </Button>
          </div>
          
          <audio
            ref={audioElement}
            src={URL.createObjectURL(audioBlob)}
            onTimeUpdate={() => {
              if (audioElement.current) {
                setCurrentTime(Math.floor(audioElement.current.currentTime));
              }
            }}
            onEnded={() => {
              setIsPlaying(false);
              setCurrentTime(0);
            }}
          />
        </>
      ) : (
        <Button
          variant={isRecording ? 'destructive' : 'default'}
          onClick={isRecording ? stopRecording : startRecording}
          className="w-full"
        >
          <FiMic className="mr-2" />
          {isRecording ? `Recording ${formatTime(recordingTime)}` : 'Record Voice Message'}
        </Button>
      )}
    </div>
  );
} 
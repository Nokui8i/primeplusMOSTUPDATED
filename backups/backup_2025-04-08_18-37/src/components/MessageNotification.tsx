import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { Message, Chat } from '@/lib/messages';
import { Avatar } from './ui/avatar';
import { motion, AnimatePresence } from 'framer-motion';

interface MessageNotificationProps {
  message: Message;
  chat: Chat;
}

export function MessageNotification({ message, chat }: MessageNotificationProps) {
  const [isVisible, setIsVisible] = useState(true);
  const router = useRouter();
  const { user } = useAuth();

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
    }, 5000); // Hide after 5 seconds

    return () => clearTimeout(timer);
  }, []);

  const handleClick = () => {
    router.push('/messages');
    setIsVisible(false);
  };

  if (!isVisible || message.senderId === user?.uid) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -100 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -100 }}
        className="fixed top-4 right-4 z-50 w-80"
      >
        <button
          onClick={handleClick}
          className="w-full bg-white rounded-lg shadow-lg p-4 flex items-start gap-3 hover:bg-gray-50 transition-colors border border-border"
        >
          <Avatar className="h-10 w-10" />
          <div className="flex-1 text-left">
            <p className="font-medium text-sm">
              {chat.participants.filter(id => id !== user?.uid).join(', ')}
            </p>
            <p className="text-sm text-muted-foreground line-clamp-2">
              {message.text}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {message.timestamp.toLocaleTimeString()}
            </p>
          </div>
        </button>
      </motion.div>
    </AnimatePresence>
  );
} 
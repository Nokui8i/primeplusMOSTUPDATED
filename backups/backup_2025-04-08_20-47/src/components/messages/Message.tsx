import { useState } from 'react';
import { Message as MessageType, ReactionType } from '@/lib/types/messages';
import { UserAvatar } from '@/components/user/UserAvatar';
import { Button } from '@/components/ui/button';
import { FiDownload, FiCheck } from 'react-icons/fi';
import { HiCheckCircle } from 'react-icons/hi';
import { messagesService } from '@/lib/services/messages';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface MessageProps {
  message: MessageType;
  currentUserId: string;
  onReactionSelect?: (reaction: ReactionType) => void;
}

const reactionEmojis: ReactionType[] = ['👍', '❤️', '😂', '😮', '😢', '😡'];

export function Message({ message, currentUserId, onReactionSelect }: MessageProps) {
  const [showReactions, setShowReactions] = useState(false);
  const isOwnMessage = message.senderId === currentUserId;

  const handleReactionClick = async (reaction: ReactionType) => {
    try {
      if (message.reactions?.[currentUserId] === reaction) {
        await messagesService.removeReaction(message.id, currentUserId);
      } else {
        await messagesService.addReaction(message.id, currentUserId, reaction);
      }
      onReactionSelect?.(reaction);
    } catch (error) {
      console.error('Error handling reaction:', error);
    }
  };

  return (
    <div className={`flex items-start gap-4 ${isOwnMessage ? 'flex-row-reverse' : ''}`}>
      <UserAvatar 
        userId={message.senderId}
        displayName={message.senderId}
        size="sm"
        showOnlineStatus={!isOwnMessage}
      />
      
      <div className={`flex flex-col max-w-[70%] ${isOwnMessage ? 'items-end' : 'items-start'}`}>
        <div className={`rounded-lg p-3 ${
          isOwnMessage ? 'bg-primary text-primary-foreground' : 'bg-muted'
        }`}>
          {message.isDeleted ? (
            <span className="italic text-gray-400">This message was deleted</span>
          ) : (
            <>
              <p className="whitespace-pre-wrap break-words">{message.content}</p>
              
              {/* Attachments */}
              {message.attachments && message.attachments.length > 0 && (
                <div className="mt-2 space-y-2">
                  {message.attachments.map((attachment, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 p-2 rounded bg-white/50"
                    >
                      <span className="flex-1 truncate">{attachment.name}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => window.open(attachment.url, '_blank')}
                      >
                        <FiDownload className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Message Status */}
        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
          <span>
            {new Date(message.timestamp.toDate()).toLocaleTimeString([], { 
              hour: '2-digit', 
              minute: '2-digit' 
            })}
          </span>
          {isOwnMessage && (
            <span className="flex items-center">
              {message.status === 'sent' && <FiCheck className="h-4 w-4" />}
              {message.status === 'delivered' && <HiCheckCircle className="h-4 w-4" />}
              {message.status === 'read' && (
                <HiCheckCircle className="h-4 w-4 text-blue-500" />
              )}
            </span>
          )}
        </div>

        {/* Reactions */}
        <div className="flex items-center gap-1 mt-1">
          {Object.entries(message.reactions || {}).map(([userId, reaction]) => (
            <TooltipProvider key={userId}>
              <Tooltip>
                <TooltipTrigger>
                  <span className="text-sm">{reaction}</span>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Reacted by {userId === currentUserId ? 'you' : userId}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ))}
          
          <Popover open={showReactions} onOpenChange={setShowReactions}>
            <PopoverTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-6 px-2 text-xs"
              >
                😀
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-2">
              <div className="flex gap-2">
                {reactionEmojis.map((emoji) => (
                  <button
                    key={emoji}
                    className="text-xl hover:scale-125 transition-transform"
                    onClick={() => {
                      handleReactionClick(emoji);
                      setShowReactions(false);
                    }}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </div>
  );
} 
import { PostWithAuthor } from '@/lib/types/post'
import { formatDistanceToNow } from 'date-fns'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import Link from 'next/link'
import MediaContent from './MediaContent'
import { Badge } from '@/components/ui/badge'
import { Timestamp } from 'firebase/firestore'

interface PostProps {
  post: PostWithAuthor
}

export function Post({ post }: PostProps) {
  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'Just now'
    if (timestamp instanceof Timestamp) {
      return formatDistanceToNow(timestamp.toDate(), { addSuffix: false })
    }
    if (timestamp instanceof Date) {
      return formatDistanceToNow(timestamp, { addSuffix: false })
    }
    return 'Just now'
  }

  // Add a helper to render content with clickable @mentions and URLs
  function renderContentWithMentions(content: string) {
    // Regex patterns for mentions and URLs
    const mentionRegex = /@([a-zA-Z0-9_]+)/g;
    const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+|[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(?:\/[^\s]*)?)/g;
    
    const parts = [];
    let lastIndex = 0;
    
    // Find all matches (mentions and URLs)
    const allMatches = [];
    
    // Find mentions
    let match;
    while ((match = mentionRegex.exec(content)) !== null) {
      allMatches.push({
        type: 'mention',
        start: match.index,
        end: mentionRegex.lastIndex,
        text: match[0],
        username: match[1]
      });
    }
    
    // Find URLs
    urlRegex.lastIndex = 0; // Reset regex
    while ((match = urlRegex.exec(content)) !== null) {
      allMatches.push({
        type: 'url',
        start: match.index,
        end: urlRegex.lastIndex,
        text: match[0],
        url: match[0].startsWith('http') ? match[0] : `https://${match[0]}`
      });
    }
    
    // Sort matches by position
    allMatches.sort((a, b) => a.start - b.start);
    
    // Render content with both mentions and URLs
    allMatches.forEach((match) => {
      if (match.start > lastIndex) {
        parts.push(content.slice(lastIndex, match.start));
      }
      
        if (match.type === 'mention') {
          parts.push(
            <Link
              key={match.start}
              href={`/profile/${match.username}`}
              className="text-blue-600 hover:underline font-semibold cursor-pointer"
            >
              @{match.username}
            </Link>
          );
      } else if (match.type === 'url') {
        parts.push(
          <a
            key={match.start}
            href={match.url}
            className="text-blue-600 hover:underline cursor-pointer"
            target="_blank"
            rel="noopener noreferrer"
          >
            {match.text}
          </a>
        );
      }
      
      lastIndex = match.end;
    });
    
    if (lastIndex < content.length) {
      parts.push(content.slice(lastIndex));
    }
    
    return parts;
  }

  // Debug log for watermark

  return (
    <div className="post-container bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 mb-4">
      <div className="flex items-start space-x-4">
        <Link href={`/profile/${post.authorId}`}>
          <Avatar className="w-12 h-12">
            <AvatarImage src={post.author?.photoURL || ''} />
            <AvatarFallback>{post.author?.displayName?.[0] || 'U'}</AvatarFallback>
          </Avatar>
        </Link>
        
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <Link href={`/profile/${post.authorId}`}>
              <span className="font-semibold text-gray-900 dark:text-gray-100 hover:underline">
                {post.author?.displayName || 'Anonymous'}
              </span>
            </Link>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {formatDate(post.createdAt)}
            </span>
          </div>

          {post.content && (
            <p className="mt-2 text-gray-700 dark:text-gray-300">
              {renderContentWithMentions(post.content)}
            </p>
          )}

          {post.mediaUrl && (
            <div className="mt-3">
              <MediaContent 
                url={post.mediaUrl} 
                type={post.type || 'text'} 
                thumbnailUrl={post.thumbnailUrl}
                dimensions={(post as any).metadata ? {
                  width: (post as any).metadata.width || 0,
                  height: (post as any).metadata.height || 0,
                  aspectRatio: Number((post as any).metadata.aspectRatio) || 16/9
                } : undefined}
                username={post.author?.username}
                showWatermark={(post as any).showWatermark !== false}
              />
            </div>
          )}

          {post.tags && post.tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {post.tags.map((tag, index) => (
                <Badge key={index} variant="secondary">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
} 
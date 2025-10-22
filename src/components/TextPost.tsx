import React from 'react';
import { cn } from '@/lib/utils';
import { PostWithAuthor } from '@/lib/types/post';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';
import { PostOptionsMenu } from '@/components/PostOptionsMenu';

interface TextPostProps {
  post: PostWithAuthor;
}

export function TextPost({ post }: TextPostProps) {
  const handleEdit = () => {
    // Implement the edit logic here
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
      {/* Post Header */}
      <div className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Avatar className="h-12 w-12 rounded-full">
              <AvatarImage src={post.author?.photoURL || '/default-avatar.png'} alt={post.author?.displayName || 'User avatar'} />
              <AvatarFallback>{post.author?.displayName?.[0] || 'U'}</AvatarFallback>
            </Avatar>
            <div>
              <div className="flex items-center gap-2">
                <Link href={`/profile/${post.author?.username || post.author?.id}`}>
                  <span className="font-semibold text-base text-gray-900 dark:text-gray-100 hover:underline">
                    {post.author?.displayName || 'Anonymous'}
                  </span>
                </Link>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {formatDistanceToNow(
                    post.createdAt instanceof Date 
                      ? post.createdAt 
                      : (post.createdAt as any)?.toDate() || new Date(),
                    { addSuffix: true }
                  )}
                </span>
              </div>
            </div>
          </div>
          <PostOptionsMenu
            postId={post.id}
            authorId={post.authorId}
            onEdit={handleEdit}
          />
        </div>

        {/* Post Content */}
        <div className="mt-4">
          <p className="ml-10 -mt-3 text-sm text-gray-900 dark:text-gray-100 leading-relaxed whitespace-pre-wrap">
            {post.content}
          </p>
        </div>
      </div>

      {/* Post Actions */}
      <div className="px-6 py-3 flex items-center gap-6">
        <div className="flex items-center space-x-4">
          <button className="flex items-center space-x-1 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
            <span className="text-sm">{post.likes || 0}</span>
          </button>
          <button className="flex items-center space-x-1 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <span className="text-sm">{post.comments || 0}</span>
          </button>
        </div>
      </div>
    </div>
  );
} 
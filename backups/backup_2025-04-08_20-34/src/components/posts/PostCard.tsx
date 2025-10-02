'use client';

import { useState } from 'react';
import Image from 'next/image';
import { formatDistanceToNow } from 'date-fns';
import { Post } from '@/lib/types/post';
import { UserProfile } from '@/lib/types/user';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { FiHeart, FiMessageSquare, FiShare2, FiBookmark, FiLock } from 'react-icons/fi';

interface PostCardProps {
  post: Post;
  variant?: 'default' | 'media';
}

export function PostCard({ post, variant = 'default' }: PostCardProps) {
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const { toast } = useToast();

  const handleLike = async () => {
    try {
      // TODO: Implement like functionality
      setLiked(!liked);
      toast({
        title: liked ? 'Post unliked' : 'Post liked',
        description: liked ? 'The post has been removed from your likes' : 'The post has been added to your likes',
      });
    } catch (error) {
      console.error('Error liking post:', error);
      toast({
        title: 'Error',
        description: 'Could not update like status. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleSave = async () => {
    try {
      // TODO: Implement save functionality
      setSaved(!saved);
      toast({
        title: saved ? 'Post unsaved' : 'Post saved',
        description: saved ? 'The post has been removed from your saved items' : 'The post has been saved to your collection',
      });
    } catch (error) {
      console.error('Error saving post:', error);
      toast({
        title: 'Error',
        description: 'Could not update save status. Please try again.',
        variant: 'destructive',
      });
    }
  };

  if (variant === 'media') {
    return (
      <div className="relative aspect-square rounded-lg overflow-hidden group">
        {post.mediaUrl ? (
          <>
            <Image
              src={post.thumbnailUrl || post.mediaUrl}
              alt={post.title || 'Post media'}
              fill
              className="object-cover transition-transform group-hover:scale-105"
            />
            {post.isPremium && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <FiLock className="h-8 w-8 text-white" />
              </div>
            )}
            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center space-x-4">
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:text-brand-pink-main"
                onClick={handleLike}
              >
                <FiHeart className={`h-6 w-6 ${liked ? 'fill-current' : ''}`} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:text-brand-pink-main"
                onClick={handleSave}
              >
                <FiBookmark className={`h-6 w-6 ${saved ? 'fill-current' : ''}`} />
              </Button>
            </div>
          </>
        ) : (
          <div className="w-full h-full bg-gray-100 flex items-center justify-center">
            <span className="text-gray-400">No media</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm p-6 space-y-4">
      {/* Post Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center space-x-3">
          <div className="relative h-10 w-10">
            <Image
              src={post.author?.photoURL || '/default-avatar.png'}
              alt={post.author?.displayName || 'User'}
              fill
              className="rounded-full object-cover"
            />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-semibold">
                {post.author?.displayName || 'Anonymous'}
              </span>
              {post.author?.isVerified && (
                <Badge variant="secondary">Verified</Badge>
              )}
            </div>
            <span className="text-sm text-gray-500">
              {formatDistanceToNow(post.createdAt.toDate(), { addSuffix: true })}
            </span>
          </div>
        </div>
        {post.isPremium && (
          <Badge variant="secondary" className="bg-brand-pink-main text-white">
            Premium
          </Badge>
        )}
      </div>

      {/* Post Content */}
      <div className="space-y-4">
        {post.title && (
          <h2 className="text-xl font-semibold">{post.title}</h2>
        )}
        <p className="text-gray-600">{post.content}</p>
        {post.mediaUrl && (
          <div className="relative aspect-video rounded-lg overflow-hidden">
            <Image
              src={post.thumbnailUrl || post.mediaUrl}
              alt={post.title || 'Post media'}
              fill
              className="object-cover"
            />
            {post.type === 'video' && (
              <div className="absolute bottom-2 right-2 bg-black/70 text-white text-sm px-2 py-1 rounded">
                {post.metadata?.duration ? `${Math.floor(post.metadata.duration / 60)}:${String(post.metadata.duration % 60).padStart(2, '0')}` : '00:00'}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Post Actions */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-100">
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            size="sm"
            className="text-gray-500 hover:text-brand-pink-main"
            onClick={handleLike}
          >
            <FiHeart className={`h-5 w-5 mr-2 ${liked ? 'fill-current text-brand-pink-main' : ''}`} />
            <span>{post.likes || 0}</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-gray-500 hover:text-brand-pink-main"
          >
            <FiMessageSquare className="h-5 w-5 mr-2" />
            <span>{post.comments || 0}</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-gray-500 hover:text-brand-pink-main"
          >
            <FiShare2 className="h-5 w-5 mr-2" />
            <span>{post.shares || 0}</span>
          </Button>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="text-gray-500 hover:text-brand-pink-main"
          onClick={handleSave}
        >
          <FiBookmark className={`h-5 w-5 ${saved ? 'fill-current text-brand-pink-main' : ''}`} />
        </Button>
      </div>
    </div>
  );
} 
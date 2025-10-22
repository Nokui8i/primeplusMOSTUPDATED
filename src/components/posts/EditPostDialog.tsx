import { useState, useEffect } from 'react'
import { Post as PostType } from '@/lib/types/post'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { updatePost } from '@/lib/firebase/db'
import { toast } from 'react-hot-toast'
import { Label } from '@/components/ui/label'
import MediaContent from '@/components/posts/MediaContent'
import { useAuth } from '@/lib/firebase/auth'
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { X } from 'lucide-react'

interface EditPostDialogProps {
  post: PostType
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function EditPostDialog({
  post,
  open,
  onOpenChange,
}: EditPostDialogProps) {
  const { user } = useAuth()
  const [content, setContent] = useState(post.content || '')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [accessLevel, setAccessLevel] = useState<'public' | 'followers'>(() => {
    if (post.accessSettings?.accessLevel === 'followers') {
      return 'followers';
    }
    return 'public';
  });

  useEffect(() => {
    if (open) {
      setContent(post.content || '')
      setAccessLevel(() => {
        if (post.accessSettings?.accessLevel === 'followers') {
          return 'followers';
        }
        // If isPublic is true, or accessLevel is 'free', or no specific access settings, default to 'public' for the UI.
        // Essentially, if it's not explicitly 'followers', the UI selector shows 'public'.
        return 'public';
      });
    }
  }, [post, open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim()) return
    if (!user) {
      toast.error('You must be logged in to edit posts')
      return
    }
    if (user.uid !== post.authorId) {
      toast.error('You can only edit your own posts')
      return
    }

    setIsSubmitting(true)
    try {
      await updatePost(post.id, {
        content: content.trim(),
        isPublic: accessLevel === 'public',
        accessSettings: {
          ...(post.accessSettings || {}),
          isPremium: post.accessSettings?.isPremium || false,
          accessLevel: accessLevel === 'public' ? 'free' : 'followers',
        },
      })
      toast.success('Post updated successfully')
      onOpenChange(false)
    } catch (error) {
      console.error('Error updating post:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to update post')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = () => {
    setContent(post.content || '')
    onOpenChange(false)
  }

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={(e) => {
        // Only close if clicking the backdrop, not the content
        if (e.target === e.currentTarget) {
          handleClose();
        }
      }}
    >
      <div className="upload-card" onClick={(e) => e.stopPropagation()}>
        <div className="upload-title">
          Edit Post
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-4 top-3 h-8 w-8 rounded-full hover:bg-gray-100 text-gray-600"
            onClick={handleClose}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
        
        <div className="upload-content">
          <div className="content-area">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="content">Content</Label>
                <textarea
                  id="content"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="What's on your mind?"
                  className="text-input"
                  rows={4}
                  aria-describedby="content-description"
                />
                <p id="content-description" className="sr-only">
                  Edit your post content here. Press Enter for new lines.
                </p>
              </div>
              
              <div className="space-y-2">
                <Label className="text-sm font-medium">Post Visibility</Label>
                <RadioGroup 
                  value={accessLevel}
                  onValueChange={(value: 'public' | 'followers') => setAccessLevel(value)}
                  className="flex items-center space-x-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="public" id="edit-access-public" />
                    <Label htmlFor="edit-access-public" className="text-sm font-normal">Public</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="followers" id="edit-access-followers" />
                    <Label htmlFor="edit-access-followers" className="text-sm font-normal">Subscribers Only</Label>
                  </div>
                </RadioGroup>
                <p className="text-xs text-gray-500">
                  {accessLevel === 'public' 
                    ? 'Everyone will be able to see this post.' 
                    : 'Only your subscribers will be able to see this post.'}
                </p>
              </div>
              
              {post.mediaUrl && (
                <div className="space-y-2">
                  <Label>Current Media</Label>
                  <div className="rounded-lg overflow-hidden">
                    <MediaContent url={post.mediaUrl} type={post.type} />
                  </div>
                  <p className="text-sm text-gray-500">
                    Note: Media files cannot be changed after upload. To change the media, please create a new post.
                  </p>
                </div>
              )}
              
              <div className="flex justify-end space-x-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleClose}
                  className="px-6 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={!content.trim() || content.trim() === post.content?.trim() || isSubmitting}
                  className="px-6 py-2 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-medium transition-all duration-200 shadow-lg hover:shadow-xl"
                >
                  {isSubmitting ? 'Saving...' : 'SAVE CHANGES'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
} 
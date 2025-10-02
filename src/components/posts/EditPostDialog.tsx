import { useState, useEffect } from 'react'
import { Post as PostType } from '@/lib/types/post'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { updatePost } from '@/lib/firebase/db'
import { toast } from 'react-hot-toast'
import { Label } from '@/components/ui/label'
import MediaContent from '@/components/posts/MediaContent'
import { useAuth } from '@/hooks/useAuth'
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

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
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit Post</DialogTitle>
          <DialogDescription>
            Make changes to your post content below.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="content">Content</Label>
            <Textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="What's on your mind?"
              className="min-h-[200px]"
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
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={!content.trim() || content.trim() === post.content?.trim() || isSubmitting}
            >
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
} 
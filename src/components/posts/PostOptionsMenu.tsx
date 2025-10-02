import { useState } from 'react'
import { useAuth } from '@/lib/firebase/auth'
import { useRouter } from 'next/navigation'
import { MoreHorizontal, Trash2, Edit, Share2 } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'
import { deletePost } from '@/lib/firebase/db'

interface PostOptionsMenuProps {
  postId: string
  authorId: string
  onEdit?: () => void
}

export default function PostOptionsMenu({ postId, authorId, onEdit }: PostOptionsMenuProps) {
  const { user } = useAuth()
  const router = useRouter()
  const [isDeleting, setIsDeleting] = useState(false)

  const isAuthor = user?.uid === authorId

  const handleDelete = async () => {
    if (!isAuthor || !user) return;

    try {
      setIsDeleting(true);
      await deletePost(postId, user.uid);
      toast.success('Post deleted successfully');
      router.refresh();
    } catch (error) {
      console.error('Error deleting post:', error);
      toast.error('Failed to delete post');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleShare = () => {
    const url = `${window.location.origin}/post/${postId}`
    navigator.clipboard.writeText(url)
      .then(() => toast.success('Link copied to clipboard'))
      .catch(() => toast.error('Failed to copy link'))
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button 
          className="h-8 w-8 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center justify-center focus:outline-none focus:ring-0 focus:ring-offset-0 focus:border-none !focus-visible:ring-0 !focus-visible:ring-offset-0"
        >
          <MoreHorizontal className="h-4 w-4 text-black dark:text-white" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {isAuthor && (
          <>
            <DropdownMenuItem onClick={onEdit} disabled={isDeleting}>
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={handleDelete} 
              disabled={isDeleting}
              className="text-red-500 focus:text-red-500"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </>
        )}
        <DropdownMenuItem onClick={handleShare} disabled={isDeleting}>
          <Share2 className="mr-2 h-4 w-4" />
          Share
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
} 
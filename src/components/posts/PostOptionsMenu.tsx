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
  const [isOpen, setIsOpen] = useState(false)

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
    <DropdownMenu onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <button 
          className={`h-8 w-8 rounded-md flex items-center justify-center focus:outline-none focus:ring-0 focus:ring-offset-0 focus:border-none !focus-visible:ring-0 !focus-visible:ring-offset-0 transition-colors ${
            isOpen 
              ? 'text-blue-600' 
              : 'text-black dark:text-white hover:text-gray-600'
          }`}
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48 bg-white border border-gray-200 shadow-lg">
        {isAuthor && (
          <>
            <DropdownMenuItem 
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('🔍 Edit clicked!');
                if (onEdit) onEdit();
              }} 
              disabled={isDeleting} 
              className="bg-white hover:bg-gray-50 cursor-pointer"
            >
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('🔍 Delete clicked!');
                handleDelete();
              }} 
              disabled={isDeleting}
              className="text-red-500 focus:text-red-500 bg-white hover:bg-red-50 cursor-pointer"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </>
        )}
        <DropdownMenuItem 
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('🔍 Share clicked!');
            handleShare();
          }} 
          disabled={isDeleting} 
          className="bg-white hover:bg-gray-50 cursor-pointer"
        >
          <Share2 className="mr-2 h-4 w-4" />
          Share
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
} 
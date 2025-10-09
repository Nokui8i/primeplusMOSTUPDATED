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
          className={`px-3 py-1.5 rounded-full flex items-center justify-center focus:outline-none focus:ring-0 focus:ring-offset-0 focus:border-none !focus-visible:ring-0 !focus-visible:ring-offset-0 transition-all duration-200 ${
            isOpen 
              ? 'bg-blue-50 text-blue-600' 
              : 'bg-white border border-gray-200 text-black dark:text-white hover:bg-gray-50 shadow-sm'
          }`}
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        align="end" 
        className="w-48 bg-white border-0 overflow-hidden p-0"
        style={{
          borderRadius: '12px',
          boxShadow: '0 8px 16px rgba(0, 0, 0, 0.15), 0 2px 4px rgba(0, 0, 0, 0.1)',
          background: 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)',
        }}
      >
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
              className="cursor-pointer py-2 px-3 hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 transition-all duration-200"
              style={{ fontWeight: '500', fontSize: '14px' }}
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
              className="cursor-pointer py-2 px-3 text-red-500 hover:bg-gradient-to-r hover:from-red-50 hover:to-pink-50 transition-all duration-200"
              style={{ fontWeight: '500', fontSize: '14px' }}
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
          className="cursor-pointer py-2 px-3 hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 transition-all duration-200"
          style={{ fontWeight: '500', fontSize: '14px' }}
        >
          <Share2 className="mr-2 h-4 w-4" />
          Share
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
} 
import { MoreVertical } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface PostOptionsMenuProps {
  postId: string;
  authorId: string;
  onEdit: () => void;
}

export function PostOptionsMenu({ postId, authorId, onEdit }: PostOptionsMenuProps) {
  const { user } = useAuth();
  const isAuthor = user?.uid === authorId;

  if (!isAuthor) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-700">
        <MoreVertical className="h-5 w-5 text-gray-500 dark:text-gray-400" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onEdit}>
          Edit Post
        </DropdownMenuItem>
        <DropdownMenuItem className="text-red-600 dark:text-red-400">
          Delete Post
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
} 
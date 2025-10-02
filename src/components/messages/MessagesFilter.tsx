'use client';

import { ChevronDown, Link2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useUnreadCount } from '@/lib/messages';

interface MessagesFilterProps {
  filter: 'all' | 'unread';
  onFilterChange: (filter: 'all' | 'unread') => void;
  sortBy: 'newest' | 'oldest';
  onSortChange: (sort: 'newest' | 'oldest') => void;
}

export function MessagesFilter({
  filter,
  onFilterChange,
  sortBy,
  onSortChange,
}: MessagesFilterProps) {
  const unreadCount = useUnreadCount();
  
  const handleCopyLink = () => {
    // TODO: Implement copy link functionality
    console.log('Copying messages link');
  };

  return (
    <div className="flex items-center justify-between p-4 border-b">
      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="text-muted-foreground">
              {sortBy === 'newest' ? 'NEWEST FIRST' : 'OLDEST FIRST'}
              <ChevronDown className="ml-2 h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => onSortChange('newest')}>
              Newest First
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onSortChange('oldest')}>
              Oldest First
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant={filter === 'all' ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => onFilterChange('all')}
          className="rounded-full"
        >
          All
        </Button>
        <Button
          variant={filter === 'unread' ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => onFilterChange('unread')}
          className="rounded-full"
        >
          Unread
          {unreadCount > 0 && (
            <span className="ml-2 text-xs bg-gradient-to-r from-[#FF4081] to-[#E91E63] text-white rounded-full px-2">
              {unreadCount}
            </span>
          )}
        </Button>
        <Button variant="ghost" size="icon" onClick={handleCopyLink}>
          <Link2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
} 
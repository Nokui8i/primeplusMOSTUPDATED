"use client";

import { FiMoreVertical } from 'react-icons/fi';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useFilter } from '@/contexts/FilterContext';

export function FilterDropdown() {
  const { hideLockedPosts, setHideLockedPosts } = useFilter();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button 
          className="relative p-1.5 text-gray-600 hover:text-gray-700 focus:outline-none transition-colors"
          aria-label="Filter options"
        >
          <FiMoreVertical className="w-5 h-5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        align="end" 
        className="w-44 border p-1.5"
        style={{
          background: 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)',
          border: '1px solid rgba(255, 255, 255, 0.8)',
          boxShadow: `
            0 20px 60px rgba(0, 0, 0, 0.12),
            0 8px 25px rgba(0, 0, 0, 0.08),
            0 0 0 1px rgba(255, 255, 255, 0.5) inset,
            0 2px 4px rgba(0, 0, 0, 0.04) inset
          `,
          backdropFilter: 'blur(10px)',
          transform: 'translateY(-2px)',
          transition: 'all 0.3s ease',
          borderRadius: '0.5rem'
        }}
      >
        <DropdownMenuItem
          onClick={() => setHideLockedPosts(!hideLockedPosts)}
          className="flex items-center gap-2 cursor-pointer hover:bg-gray-100 rounded-md px-2 py-1.5 transition-colors"
        >
          <input
            type="checkbox"
            checked={hideLockedPosts}
            onChange={() => setHideLockedPosts(!hideLockedPosts)}
            className="w-3.5 h-3.5 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500 cursor-pointer"
          />
          <span className="text-xs text-gray-700">Hide Locked Posts</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}


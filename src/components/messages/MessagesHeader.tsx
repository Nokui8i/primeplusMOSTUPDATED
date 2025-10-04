'use client';

import { useState } from 'react';
import { Search, ArrowLeft, MoreVertical, Bell, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MessagesAvatar } from '@/components/ui/MessagesAvatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';

interface MessagesHeaderProps {
  selectedChat: {
    recipientId: string;
    recipientName: string;
  } | null;
  onBack: () => void;
  isMobileView: boolean;
}

export function MessagesHeader({ selectedChat, onBack, isMobileView }: MessagesHeaderProps) {
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <div className="border-b border-gray-200 bg-white/95 backdrop-blur-sm shadow-sm">
      <div className="flex items-center justify-between px-3 py-2"> {/* PADDING: px-3 py-2 */}
        {/* Left side - Back button (mobile) or Search */}
        <div className="flex items-center gap-3 flex-1"> {/* PADDING: gap-3 */}
          {selectedChat && isMobileView && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onBack}
              className="h-8 w-8 hover:bg-gray-100 rounded-full transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          
          {!selectedChat && (
            <div className="flex-1 max-w-sm"> {/* PADDING: max-w-sm (384px) */}
              <div className="relative">
                <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" /> {/* PADDING: left-2 */}
                <Input
                  placeholder="Search by name or username..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 pr-3 py-1.5 h-8 bg-gray-50 border-gray-200 focus:bg-white focus:border-blue-300 focus:ring-1 focus:ring-blue-300 transition-all duration-200 text-sm" /* PADDING: pl-8 pr-3 py-1.5 h-8 */
                />
              </div>
            </div>
          )}
          
          {selectedChat && !isMobileView && (
            <div className="flex items-center gap-4">
              <div className="relative flex-shrink-0 w-14 h-14"> {/* PADDING: w-14 h-14 (56px) - exact avatar size */}
                <MessagesAvatar 
                  src="/default-avatar.png"
                  alt={selectedChat.recipientName}
                  fallback={selectedChat.recipientName[0]}
                  size="lg"
                />
                <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 border-2 border-white rounded-full"></div>
              </div>
              <div>
                <h2 className="font-semibold text-gray-900 text-sm">
                  {selectedChat.recipientName}
                </h2>
                <p className="text-xs text-green-600 font-medium">Online</p>
              </div>
            </div>
          )}
        </div>

        {/* Right side - Actions */}
        <div className="flex items-center gap-2">
          {!selectedChat && (
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-gray-100 rounded-full">
                <Bell className="h-4 w-4" />
              </Button>
              <div className="flex items-center gap-2">
                <div className="text-sm text-gray-500 font-medium">Suggested</div>
                <div className="relative flex-shrink-0 w-12 h-12"> {/* PADDING: w-12 h-12 (48px) - exact avatar size */}
                  <MessagesAvatar 
                    src="/default-avatar.png"
                    alt="Suggested user"
                    fallback="U"
                    size="md"
                  />
                </div>
              </div>
            </div>
          )}
          
          {selectedChat && (
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-gray-100 rounded-full">
                <UserPlus className="h-4 w-4" />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-gray-100 rounded-full">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem className="flex items-center gap-2">
                    <UserPlus className="h-4 w-4" />
                    View Profile
                  </DropdownMenuItem>
                  <DropdownMenuItem className="flex items-center gap-2">
                    <Bell className="h-4 w-4" />
                    Mute Notifications
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="flex items-center gap-2 text-red-600 focus:text-red-600">
                    Block User
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
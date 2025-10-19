'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, UserX, Shield, Clock, User, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { UserProfile } from '@/lib/types/user';
import { blockUser, unblockUser, getBlockedUsers, searchUsers, BlockedUser } from '@/lib/services/block.service';

export default function BlockSettingsTab() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [blocking, setBlocking] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [lastUserId, setLastUserId] = useState<string | undefined>();

  useEffect(() => {
    loadBlockedUsers();
  }, [user?.uid]);

  // Auto-search when query changes
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchQuery.trim()) {
        handleSearchUsers();
      } else {
        setSearchResults([]);
      }
    }, 300); // 300ms delay

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  const loadBlockedUsers = async (reset = true) => {
    if (!user?.uid) return;

    try {
      if (reset) {
        setLoading(true);
        setBlockedUsers([]);
        setLastUserId(undefined);
      } else {
        setLoadingMore(true);
      }

      const result = await getBlockedUsers(user.uid, 20, reset ? undefined : lastUserId);
      
      if (reset) {
        setBlockedUsers(result.users);
      } else {
        setBlockedUsers(prev => [...prev, ...result.users]);
      }
      
      setHasMore(result.hasMore);
      setLastUserId(result.lastUserId);
    } catch (error) {
      console.error('Error loading blocked users:', error);
      toast({
        title: "Error",
        description: "Failed to load blocked users",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const handleSearchUsers = async () => {
    if (!searchQuery.trim() || !user?.uid) return;

    setSearching(true);
    try {
      const blockedUserIds = blockedUsers.map(user => user.uid);
      const results = await searchUsers(searchQuery, user.uid, blockedUserIds);
      setSearchResults(results);
    } catch (error) {
      console.error('Error searching users:', error);
      toast({
        title: "Error",
        description: "Failed to search users",
        variant: "destructive",
      });
    } finally {
      setSearching(false);
    }
  };

  const handleBlockUser = async (userToBlock: UserProfile) => {
    if (!user?.uid) return;

    setBlocking(userToBlock.uid);
    try {
      await blockUser(user.uid, userToBlock.uid);

      // Add to blocked users list
      const newBlockedUser: BlockedUser = {
        uid: userToBlock.uid,
        displayName: userToBlock.displayName,
        username: userToBlock.username,
        photoURL: userToBlock.photoURL,
        blockedAt: new Date(),
      };

      setBlockedUsers(prev => [...prev, newBlockedUser]);
      setSearchResults(prev => prev.filter(u => u.uid !== userToBlock.uid));

      toast({
        title: "User Blocked",
        description: `${userToBlock.displayName} has been blocked`,
      });
    } catch (error) {
      console.error('Error blocking user:', error);
      toast({
        title: "Error",
        description: "Failed to block user",
        variant: "destructive",
      });
    } finally {
      setBlocking(null);
    }
  };

  const handleUnblockUser = async (userToUnblock: BlockedUser) => {
    if (!user?.uid) return;

    try {
      await unblockUser(user.uid, userToUnblock.uid);

      // Remove from blocked users list
      setBlockedUsers(prev => prev.filter(u => u.uid !== userToUnblock.uid));

      toast({
        title: "User Unblocked",
        description: `${userToUnblock.displayName} has been unblocked`,
      });
    } catch (error) {
      console.error('Error unblocking user:', error);
      toast({
        title: "Error",
        description: "Failed to unblock user",
        variant: "destructive",
      });
    }
  };

  const handleLoadMore = () => {
    loadBlockedUsers(false);
  };


  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-normal">
            <Shield className="h-4 w-4" />
            Blocked Users ({blockedUsers.length})
          </h3>
        </div>
        
        {/* Search Icon - Integrated in Header */}
        <div className="relative">
          <style jsx>{`
            .search-container {
              position: relative !important;
              --size-button: 32px;
              color: white;
              top: -2px !important;
            }
            
            .search-input {
              padding-left: var(--size-button) !important;
              height: var(--size-button) !important;
              font-size: 13px !important;
              border: none !important;
              color: #000 !important;
              outline: none !important;
              width: var(--size-button) !important;
              transition: all ease 0.3s !important;
              background-color: #fff !important;
              box-shadow: 1.5px 1.5px 3px #e5e7eb, -1.5px -1.5px 3px rgba(156, 163, 175, 0.25), inset 0px 0px 0px #e5e7eb, inset 0px -0px 0px rgba(156, 163, 175, 0.25) !important;
              border-radius: 50px !important;
              cursor: pointer !important;
              margin: 0 !important;
              padding-top: 0 !important;
              padding-bottom: 0 !important;
              padding-right: 0 !important;
            }
            
            .search-input:focus,
            .search-input:not(:invalid) {
              width: 200px !important;
              cursor: text !important;
              border: none !important;
              outline: none !important;
              box-shadow: 0px 0px 0px #e5e7eb, 0px 0px 0px rgba(156, 163, 175, 0.25), inset 1.5px 1.5px 3px #e5e7eb, inset -1.5px -1.5px 3px rgba(156, 163, 175, 0.25) !important;
            }
            
            .search-input:focus + .search-icon,
            .search-input:not(:invalid) + .search-icon {
              pointer-events: all !important;
              cursor: pointer !important;
            }
            
            .search-icon {
              position: absolute !important;
              width: var(--size-button) !important;
              height: var(--size-button) !important;
              top: -2px !important;
              left: 1px !important;
              padding: 6px !important;
              pointer-events: none !important;
            }
            
            .search-icon svg {
              width: 100% !important;
              height: 100% !important;
            }
          `}</style>
          <div className="search-container">
            <input
              type="text"
              name="search"
              className="search-input"
              required
              placeholder="Search users to block..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleSearchUsers();
                }
              }}
              autoComplete="off"
            />
            <div className="search-icon">
              <Search className="w-full h-full text-gray-500" />
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div>
          {/* Search Results - Show above blocked users */}
          {searchResults.length > 0 && (
            <div className="mb-6">
              <h4 className="text-sm font-medium text-gray-700 mb-3">Search Results ({searchResults.length})</h4>
              <div className="space-y-2">
                {searchResults.map((user) => (
                  <div
                    key={user.uid}
                    className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200"
                  >
                    <div className="flex items-center gap-3">
                      <img
                        src={user.photoURL || '/default-avatar.png'}
                        alt={user.displayName}
                        className="w-8 h-8 rounded-full object-cover"
                      />
                      <div>
                        <p className="text-sm font-medium text-gray-900">{user.displayName}</p>
                        <p className="text-xs text-gray-500">@{user.username}</p>
                      </div>
                    </div>
                    <Button
                      onClick={() => handleBlockUser(user)}
                      disabled={blocking === user.uid}
                      className="profile-btn"
                      style={{
                        border: 'none',
                        color: '#fff',
                        backgroundImage: 'linear-gradient(30deg, #ef4444, #dc2626)',
                        backgroundColor: 'transparent',
                        borderRadius: '12px',
                        backgroundSize: '100% auto',
                        fontFamily: 'inherit',
                        fontSize: '10px',
                        padding: '0.4em 0.8em',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '4px',
                        cursor: 'pointer',
                        outline: 'none',
                        transition: 'all 0.3s ease-in-out',
                        boxShadow: 'none',
                        margin: '0',
                        width: 'auto',
                        height: 'auto',
                        fontWeight: '600',
                        textTransform: 'uppercase',
                        letterSpacing: '0.3px',
                      }}
                    >
                      {blocking === user.uid ? (
                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                      ) : (
                        <UserX className="h-3 w-3" />
                      )}
                      Block
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {blockedUsers.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Shield className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p className="text-sm">No blocked users yet</p>
              <p className="text-xs">Search and block users to manage access to your content</p>
            </div>
          ) : (
            <div className="space-y-3">
              {blockedUsers.map((blockedUser) => (
                <div
                  key={blockedUser.uid}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <img
                      src={blockedUser.photoURL || '/default-avatar.png'}
                      alt={blockedUser.displayName}
                      className="w-8 h-8 rounded-full object-cover"
                    />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{blockedUser.displayName}</p>
                      <p className="text-xs text-gray-500">@{blockedUser.username}</p>
                    </div>
                  </div>
                  <Button
                    onClick={() => handleUnblockUser(blockedUser)}
                    className="profile-btn"
                    style={{
                      border: 'none',
                      color: '#fff',
                      backgroundImage: 'linear-gradient(30deg, #10b981, #059669)',
                      backgroundColor: 'transparent',
                      borderRadius: '12px',
                      backgroundSize: '100% auto',
                      fontFamily: 'inherit',
                      fontSize: '12px',
                      padding: '0.6em 1.2em',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      cursor: 'pointer',
                      outline: 'none',
                      transition: 'all 0.3s ease-in-out',
                      boxShadow: 'none',
                      margin: '0',
                      width: 'auto',
                      height: 'auto',
                      fontWeight: '600',
                      textTransform: 'uppercase',
                      letterSpacing: '0.3px',
                    }}
                  >
                    <X className="h-4 w-4" />
                    Unblock
                  </Button>
                </div>
              ))}
            </div>
           )}

           {/* Load More Button */}
           {hasMore && (
             <div className="mt-6 text-center">
               <Button
                 onClick={handleLoadMore}
                 disabled={loadingMore}
                 className="profile-btn"
                 style={{
                   border: 'none',
                   color: '#fff',
                   backgroundImage: 'linear-gradient(30deg, #6366f1, #4f46e5)',
                   backgroundColor: 'transparent',
                   borderRadius: '12px',
                   backgroundSize: '100% auto',
                   fontFamily: 'inherit',
                   fontSize: '12px',
                   padding: '0.6em 1.2em',
                   display: 'inline-flex',
                   alignItems: 'center',
                   justifyContent: 'center',
                   gap: '6px',
                   cursor: 'pointer',
                   outline: 'none',
                   transition: 'all 0.3s ease-in-out',
                   boxShadow: 'none',
                   margin: '0',
                   width: 'auto',
                   height: 'auto',
                   fontWeight: '600',
                   textTransform: 'uppercase',
                   letterSpacing: '0.3px',
                 }}
               >
                 {loadingMore ? (
                   <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                 ) : (
                   <>
                     <User className="h-4 w-4" />
                     Load More Users
                   </>
                 )}
               </Button>
             </div>
           )}
       </div>
     </div>
   );
 }

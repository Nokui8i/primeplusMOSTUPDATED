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

  useEffect(() => {
    loadBlockedUsers();
  }, [user?.uid]);

  const loadBlockedUsers = async () => {
    if (!user?.uid) return;

    try {
      const blockedUsersData = await getBlockedUsers(user.uid);
      setBlockedUsers(blockedUsersData);
    } catch (error) {
      console.error('Error loading blocked users:', error);
      toast({
        title: "Error",
        description: "Failed to load blocked users",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Search Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-normal">
            <Search className="h-4 w-4" />
            Search Users to Block
          </CardTitle>
          <CardDescription className="text-xs text-gray-500">
            Search for users by username to block them from accessing your content
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Enter username..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1"
              style={{
                background: 'rgba(255, 255, 255, 0.9)',
                border: '1px solid rgba(0, 0, 0, 0.1)',
                borderRadius: '8px',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
                fontSize: '14px',
                padding: '12px 16px',
              }}
            />
            <Button
              onClick={handleSearchUsers}
              disabled={searching || !searchQuery.trim()}
              className="profile-btn"
              style={{
                border: 'none',
                color: '#fff',
                backgroundImage: 'linear-gradient(30deg, #3b82f6, #1d4ed8)',
                backgroundColor: 'transparent',
                borderRadius: '16px',
                backgroundSize: '100% auto',
                fontFamily: 'inherit',
                fontSize: '12px',
                padding: '0.5em 1em',
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
                letterSpacing: '0.5px',
              }}
            >
              {searching ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : (
                <Search className="h-4 w-4" />
              )}
              Search
            </Button>
          </div>

          {/* Search Results */}
          {searchResults.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-gray-700">Search Results</h4>
              {searchResults.map((user) => (
                <div
                  key={user.uid}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
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
          )}
        </CardContent>
      </Card>

      {/* Blocked Users List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-normal">
            <Shield className="h-4 w-4" />
            Blocked Users ({blockedUsers.length})
          </CardTitle>
          <CardDescription className="text-xs text-gray-500">
            Users who are blocked from accessing your content
          </CardDescription>
        </CardHeader>
        <CardContent>
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
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="destructive" className="text-xs">
                          <UserX className="h-3 w-3 mr-1" />
                          Blocked
                        </Badge>
                        <span className="text-xs text-gray-400">
                          <Clock className="h-3 w-3 inline mr-1" />
                          {blockedUser.blockedAt.toLocaleDateString()}
                        </span>
                      </div>
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
                    <X className="h-3 w-3" />
                    Unblock
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

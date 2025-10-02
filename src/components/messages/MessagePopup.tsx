'use client';

import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { UserProfile } from '@/lib/types/user';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FiSearch, FiX } from 'react-icons/fi';

interface MessagePopupProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MessagePopup({ isOpen, onClose }: MessagePopupProps) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const usersRef = collection(db, 'users');
        const q = query(
          usersRef,
          where('isActive', '==', true),
          orderBy('createdAt', 'desc'),
          limit(20)
        );
        
        const snapshot = await getDocs(q);
        const fetchedUsers = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as UserProfile));
        
        setUsers(fetchedUsers);
      } catch (error) {
        console.error('Error fetching users:', error);
      }
    };

    if (isOpen) {
      fetchUsers();
    }
  }, [isOpen]);

  const filteredUsers = users.filter(user => 
    user.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-md max-h-[80vh] overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">New Message</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-gray-500 hover:text-gray-900"
          >
            <FiX className="h-5 w-5" />
          </Button>
        </div>
        
        <div className="p-4">
          <div className="relative">
            <FiSearch className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
            <Input
              type="text"
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <div className="overflow-y-auto max-h-[60vh]">
          {filteredUsers.map(user => (
            <div
              key={user.id}
              className="p-4 hover:bg-gray-50 cursor-pointer"
              onClick={() => {
                // Handle message creation
                onClose();
              }}
            >
              <div className="flex items-center space-x-3">
                <div className="relative h-10 w-10">
                  <img
                    src={user.photoURL || '/default-avatar.png'}
                    alt={user.displayName || user.username}
                    className="rounded-full object-cover"
                  />
                </div>
                <div>
                  <p className="font-medium text-gray-900">
                    {user.displayName || user.username}
                  </p>
                  <p className="text-sm text-gray-500">@{user.username}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
} 
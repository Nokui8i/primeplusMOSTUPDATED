import React, { useState, useRef, KeyboardEvent } from 'react';
import { X, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useAuth } from '@/lib/firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';

interface UserTagInputProps {
  taggedUsers: string[];
  onTaggedUsersChange: (users: string[]) => void;
}

export function UserTagInput({ taggedUsers, onTaggedUsersChange }: UserTagInputProps) {
  const { user } = useAuth();
  const [inputValue, setInputValue] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showResults, setShowResults] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const searchUsers = async (searchTerm: string) => {
    if (!searchTerm.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      const usersRef = collection(db, 'users');
      const q = query(
        usersRef,
        where('username', '>=', searchTerm),
        where('username', '<=', searchTerm + '\uf8ff')
      );
      const querySnapshot = await getDocs(q);
      const results = querySnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(user => !taggedUsers.includes(user.id));
      setSearchResults(results);
    } catch (error) {
      console.error('Error searching users:', error);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);
    if (value && typeof value === 'string' && value.startsWith('@')) {
      const searchTerm = value.slice(1);
      searchUsers(searchTerm);
      setShowResults(true);
    } else {
      setShowResults(false);
    }
  };

  const handleUserSelect = (selectedUser: any) => {
    if (!taggedUsers.includes(selectedUser.id)) {
      onTaggedUsersChange([...taggedUsers, selectedUser.id]);
    }
    setInputValue('');
    setShowResults(false);
  };

  const removeUser = (userId: string) => {
    onTaggedUsersChange(taggedUsers.filter(id => id !== userId));
  };

  return (
    <div className="relative">
      <div className="flex flex-wrap gap-2 p-2 border rounded-md min-h-[40px]">
        {taggedUsers.map((userId) => (
          <Badge key={userId} variant="secondary" className="flex items-center gap-1">
            <Avatar className="w-4 h-4">
              <AvatarImage src={`/api/users/${userId}/avatar`} />
              <AvatarFallback>{userId[0]}</AvatarFallback>
            </Avatar>
            {userId}
            <button
              onClick={() => removeUser(userId)}
              className="ml-1 hover:text-red-500"
            >
              <X className="w-3 h-3" />
            </button>
          </Badge>
        ))}
        <Input
          ref={inputRef}
          value={inputValue}
          onChange={handleInputChange}
          placeholder={taggedUsers.length === 0 ? 'Type @ to tag someone...' : ''}
          className="flex-1 min-w-[100px] border-0 focus-visible:ring-0"
        />
      </div>
      {showResults && searchResults.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-white border rounded-md shadow-lg">
          {searchResults.map((result) => (
            <button
              key={result.id}
              className="flex items-center w-full p-2 hover:bg-gray-100"
              onClick={() => handleUserSelect(result)}
            >
              <Avatar className="w-6 h-6 mr-2">
                <AvatarImage src={`/api/users/${result.id}/avatar`} />
                <AvatarFallback>{result.username?.[0] || 'U'}</AvatarFallback>
              </Avatar>
              <span>{result.username}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
} 
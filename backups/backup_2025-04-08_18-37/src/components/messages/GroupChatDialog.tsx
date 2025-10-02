import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { UserAvatar } from '@/components/user/UserAvatar';
import { messagesService } from '@/lib/services/messages';
import { useToast } from '@/hooks/use-toast';

interface GroupChatDialogProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserId: string;
  onGroupCreated?: (threadId: string) => void;
}

export function GroupChatDialog({ isOpen, onClose, currentUserId, onGroupCreated }: GroupChatDialogProps) {
  const [groupName, setGroupName] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      toast({
        title: 'Group name required',
        description: 'Please enter a name for the group chat.',
        variant: 'destructive',
      });
      return;
    }

    if (selectedUsers.length === 0) {
      toast({
        title: 'Select members',
        description: 'Please select at least one member for the group.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      const threadId = await messagesService.createGroupChat(
        groupName,
        [...selectedUsers, currentUserId],
        currentUserId
      );
      
      toast({
        title: 'Group created',
        description: `Successfully created group "${groupName}"`,
      });
      
      onGroupCreated?.(threadId);
      onClose();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to create group chat. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create Group Chat</DialogTitle>
          <DialogDescription>
            Create a new group chat by adding a name and selecting members.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Group Name</Label>
            <Input
              id="name"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="Enter group name..."
            />
          </div>
          
          <div className="grid gap-2">
            <Label htmlFor="search">Search Members</Label>
            <Input
              id="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search users..."
            />
          </div>
          
          <div className="grid gap-2">
            <Label>Selected Members</Label>
            <div className="flex flex-wrap gap-2">
              {selectedUsers.map((userId) => (
                <div
                  key={userId}
                  className="flex items-center gap-2 bg-secondary p-2 rounded-md"
                >
                  <UserAvatar userId={userId} size="sm" />
                  <button
                    onClick={() => setSelectedUsers(users => users.filter(id => id !== userId))}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
        
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleCreateGroup} disabled={isLoading}>
            {isLoading ? 'Creating...' : 'Create Group'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
} 
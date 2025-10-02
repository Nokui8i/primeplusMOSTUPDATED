import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { FollowButton } from '@/components/FollowButton';
import Link from 'next/link';

interface User {
  id: string;
  displayName: string;
  photoURL?: string;
  bio?: string;
  username?: string;
}

interface UserCardProps {
  user: User;
}

export function UserCard({ user }: UserCardProps) {
  return (
    <Card className="p-4">
      <div className="flex items-center space-x-4">
        <Avatar className="h-12 w-12">
          <AvatarImage src={user.photoURL} alt={user.displayName} />
          <AvatarFallback>{user.displayName[0]}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <Link 
            href={`/${user.username || user.id}`}
            className="text-lg font-semibold hover:text-primary transition-colors"
          >
            {user.displayName}
          </Link>
          {user.username && (
            <p className="text-sm text-muted-foreground">
              @{user.username}
            </p>
          )}
          {user.bio && (
            <p className="text-sm text-muted-foreground mt-1 truncate">
              {user.bio}
            </p>
          )}
        </div>
        <FollowButton userId={user.id} />
      </div>
    </Card>
  );
} 
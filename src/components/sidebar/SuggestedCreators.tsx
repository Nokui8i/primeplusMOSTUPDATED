import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs, onSnapshot } from 'firebase/firestore';
import { useAuth } from '@/hooks/useAuth';
import { CreatorCard } from '../user/CreatorCard';

function shuffleArray(array: any[]) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

export function SuggestedCreators() {
  const [creators, setCreators] = useState<any[]>([]);
  const { user } = useAuth();

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'users'), (usersSnapshot) => {
      let users = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Exclude current user
      if (user) {
        users = users.filter(u => u.id !== user.uid);
      }
      // Shuffle for random order
      setCreators(shuffleArray(users));
    });
    return () => unsub();
  }, [user]);

  // Filter to only real, registered users
  const realCreators = creators.filter(
    (u) => u.email && u.profileCompleted === true && !u.email.includes('test') && !u.username?.toLowerCase().includes('test')
  );

  if (realCreators.length === 0) {
    return <div className="text-gray-500 text-sm">No creators found yet.</div>;
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-gray-900">Suggested Creators</h3>
      {realCreators.slice(0, 3).map(creator => {
        console.log('SuggestedCreators: Rendering card for creator:', {
          id: creator.id,
          username: creator.username,
          displayName: creator.displayName
        });
        return (
          <CreatorCard
            key={creator.id}
            userId={creator.id}
            username={creator.username}
            displayName={creator.displayName}
            photoURL={creator.photoURL}
            coverPhotoUrl={creator.coverPhotoUrl}
            isSimpleCard={true}
          />
        );
      })}
    </div>
  );
} 
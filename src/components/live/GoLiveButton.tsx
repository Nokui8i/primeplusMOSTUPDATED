'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Video } from 'lucide-react';

export function GoLiveButton() {
  const router = useRouter();

  return (
    <Button 
      onClick={() => router.push('/live')}
      className="flex items-center gap-2"
      variant="default"
    >
      <Video className="h-5 w-5" />
      Go Live
    </Button>
  );
}

// For backward compatibility
export default GoLiveButton; 
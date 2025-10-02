'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import LiveChat from '@/components/live/LiveChat';
import LiveStreamViewer from '@/components/live/LiveStreamViewer';

export default function WatchPage() {
  const params = useParams();
  const router = useRouter();
  const streamId = params?.streamId as string;
  
  return (
    <div className="flex flex-col lg:flex-row w-full max-w-7xl mx-auto gap-4 p-4">
      <div className="flex-1">
        <LiveStreamViewer streamId={streamId} />
      </div>
      <div className="w-full lg:w-96">
        <LiveChat streamId={streamId} />
      </div>
    </div>
  );
} 
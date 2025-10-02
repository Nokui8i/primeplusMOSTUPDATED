'use client';

import React, { useState } from 'react';
import LiveStream from '@/components/live/LiveStream';
import LiveChat from '@/components/live/LiveChat';

export default function LiveShowPage() {
  const [streamId, setStreamId] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900 p-4">
      <div className="w-full max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">Live Show</h1>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Main content area - Live Stream */}
          <div className="lg:col-span-2">
            <LiveStream onStreamStart={(id) => setStreamId(id)} />
          </div>
          
          {/* Sidebar - Live Chat */}
          <div className="lg:col-span-1">
            {streamId && <LiveChat streamId={streamId} />}
          </div>
        </div>
      </div>
    </div>
  );
} 
'use client';

import dynamic from 'next/dynamic';

const ClientUploadManager = dynamic(() => import('@/components/upload/ClientUploadManager'), {
  ssr: false,
});

export function ClientComponents() {
  return (
    <>
      <ClientUploadManager />
    </>
  );
} 
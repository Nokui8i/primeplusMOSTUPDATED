"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { Chat } from '@/components/chat/Chat';

interface ThreadPageProps {
  params: { id: string };
}

export default function ThreadPage({ params }: ThreadPageProps) {
  const router = useRouter();
  const recipientId = params.id;
  const [recipientName, setRecipientName] = useState<string>("Loading...");
  const [recipientProfile, setRecipientProfile] = useState<any>(null);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      try {
        const userDoc = await getDoc(doc(db, 'users', recipientId));
        if (!isMounted) return;
        if (userDoc.exists()) {
          const data = userDoc.data();
          setRecipientProfile(data);
          setRecipientName(data.displayName || data.username || 'Unknown User');
        } else {
          setRecipientName('Unknown User');
        }
      } catch {
        setRecipientName('Unknown User');
      }
    };
    load();
    return () => { isMounted = false; };
  }, [recipientId]);


  // Debug: Log container dimensions
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const logDimensions = () => {
      const container = document.querySelector('[data-chat-page-container]');
      if (!container) return;
      
      const computedStyle = getComputedStyle(container);
      const vvh = getComputedStyle(document.documentElement).getPropertyValue('--vvh');
      const winH = window.innerHeight;
      const vv = window.visualViewport;
      
      console.log('📱 Chat Page Container Dimensions:', {
        containerHeight: computedStyle.height,
        containerMaxHeight: computedStyle.maxHeight,
        containerBottom: computedStyle.bottom,
        cssVarVvh: vvh || 'not set',
        windowInnerHeight: winH,
        visualViewportHeight: vv?.height || 'N/A',
        visualViewportOffset: vv?.offsetTop || 0,
        containerOffsetHeight: (container as HTMLElement).offsetHeight,
        containerClientHeight: (container as HTMLElement).clientHeight,
        timestamp: new Date().toISOString()
      });
    };
    
    // Log on mount and when keyboard changes
    logDimensions();
    const interval = setInterval(logDimensions, 500); // Log every 500ms
    
    const vv = window.visualViewport;
    if (vv) {
      vv.addEventListener('resize', logDimensions);
    }
    
    return () => {
      clearInterval(interval);
      vv?.removeEventListener('resize', logDimensions);
    };
  }, []);

  return (
    <div 
      data-chat-page-container
      className="fixed flex flex-col w-full bg-white overflow-hidden"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: 'var(--vvh, 100vh)',
        maxHeight: 'var(--vvh, 100vh)',
        width: '100vw',
        zIndex: 1000,
        backfaceVisibility: 'hidden',
        WebkitBackfaceVisibility: 'hidden',
        transform: 'translateY(0)',
        willChange: 'height',
        transition: 'height 0.15s ease-out',
        overflow: 'hidden',
        margin: 0,
        padding: 0,
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box'
      }}
    >
      <Chat
        key={`${recipientId}-${recipientName}`}
        recipientId={recipientId}
        recipientName={recipientName}
        hideHeader={false}
        onClose={() => router.push('/messages')}
        recipientProfile={recipientProfile}
      />
    </div>
  );
}



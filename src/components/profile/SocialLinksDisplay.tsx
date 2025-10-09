'use client';

import { Instagram, Twitter, Facebook, Youtube, Link as LinkIcon } from 'lucide-react';

export interface SocialLink {
  id: string;
  type: 'instagram' | 'twitter' | 'website' | 'amazon' | 'other';
  url: string;
  label?: string;
}

interface SocialLinksDisplayProps {
  links: SocialLink[];
}

// TikTok Icon Component
const TikTokIcon = ({ style }: { style?: React.CSSProperties }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 448 512"
    style={style}
    fill="currentColor"
  >
    <path d="M448 209.9a210.1 210.1 0 0 1 -122.8-39.3V349.4A162.6 162.6 0 1 1 185 188.3V278.2a74.6 74.6 0 1 0 52.2 71.2V0l88 0a121.2 121.2 0 0 0 1.9 22.2h0A122.2 122.2 0 0 0 381 102.4a121.4 121.4 0 0 0 67 20.1z"/>
  </svg>
);

export function SocialLinksDisplay({ links }: SocialLinksDisplayProps) {
  console.log('🔗 SocialLinksDisplay rendering with links:', links);
  
  if (!links || links.length === 0) {
    console.log('🔗 No links to display');
    return null;
  }

  return (
    <>
      <div 
        className="social-links-container"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '10px',
          marginTop: '16px',
        }}
      >
        {links.map((link) => {
          // Auto-detect platform from URL
          const url = link.url.toLowerCase();
          let Icon: any = LinkIcon;
          let background = '#6b7280'; // Default gray
          let platformName = 'Link';
          let isTikTok = false;
          
          if (url.includes('instagram.com')) {
            Icon = Instagram;
            background = 'linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)';
            platformName = 'Instagram';
          } else if (url.includes('twitter.com') || url.includes('x.com')) {
            Icon = Twitter;
            background = '#1da1f2';
            platformName = 'Twitter';
          } else if (url.includes('facebook.com') || url.includes('fb.com')) {
            Icon = Facebook;
            background = '#1877f2';
            platformName = 'Facebook';
          } else if (url.includes('youtube.com') || url.includes('youtu.be')) {
            Icon = Youtube;
            background = '#ff0000';
            platformName = 'YouTube';
          } else if (url.includes('tiktok.com')) {
            Icon = TikTokIcon;
            background = '#000000';
            platformName = 'TikTok';
            isTikTok = true;
          }

          return (
            <a
              key={link.id}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="social-btn"
              style={{
                border: 'none',
                borderRadius: '50%',
                width: '35px',
                height: '35px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transitionDuration: '0.4s',
                cursor: 'pointer',
                position: 'relative',
                overflow: 'hidden',
                background: background,
              }}
              data-platform={platformName}
            >
              <div className="svg-icon" style={{ 
                width: '18px', 
                height: '18px', 
                color: 'white',
                transitionDuration: '0.3s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Icon 
                  style={{ 
                    width: '18px', 
                    height: '18px', 
                  }} 
                />
              </div>
              <span 
                className="btn-text"
                style={{
                  position: 'absolute',
                  color: 'rgb(255, 255, 255)',
                  width: '100px',
                  fontWeight: '600',
                  opacity: 0,
                  transitionDuration: '0.4s',
                  fontSize: '12px',
                }}
              >
                {platformName}
              </span>
            </a>
          );
        })}
      </div>
      
      <style jsx global>{`
        .social-btn:hover {
          width: 90px !important;
          transition-duration: 0.4s;
          border-radius: 25px !important;
        }
        
        .social-btn:hover .btn-text {
          opacity: 1;
          transition-duration: 0.4s;
        }
        
        .social-btn:hover .svg-icon {
          opacity: 0;
          transition-duration: 0.3s;
        }
      `}</style>
    </>
  );
}


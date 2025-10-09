'use client';

import { useState } from 'react';
import { Plus, X, ExternalLink, Instagram, Twitter, Globe, ShoppingBag, Link as LinkIcon } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

export interface SocialLink {
  id: string;
  type: 'instagram' | 'twitter' | 'website' | 'amazon' | 'other';
  url: string;
  label?: string;
}

interface SocialLinksManagerProps {
  links: SocialLink[];
  onChange: (links: SocialLink[]) => void;
}

const linkTypes = [
  { value: 'instagram', label: 'Instagram', icon: Instagram },
  { value: 'twitter', label: 'Twitter', icon: Twitter },
  { value: 'website', label: 'Website', icon: Globe },
  { value: 'amazon', label: 'Amazon Wishlist', icon: ShoppingBag },
  { value: 'other', label: 'Other Link', icon: LinkIcon },
];

export function SocialLinksManager({ links, onChange }: SocialLinksManagerProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [newLink, setNewLink] = useState<{ url: string }>({
    url: '',
  });

  const handleAddLink = () => {
    if (!newLink.url.trim()) return;

    const link: any = {
      id: Date.now().toString(),
      type: 'other' as SocialLink['type'],
      url: newLink.url.trim(),
    };

    const updatedLinks = [...links, link];
    console.log('➕ Adding new link:', link);
    console.log('📋 Updated links array:', updatedLinks);
    onChange(updatedLinks);
    setNewLink({ url: '' });
    setIsAdding(false);
  };

  const handleRemoveLink = (id: string) => {
    onChange(links.filter(link => link.id !== id));
  };

  const getLinkIcon = (type: string) => {
    const linkType = linkTypes.find(t => t.value === type);
    const Icon = linkType?.icon || LinkIcon;
    return <Icon className="w-4 h-4" />;
  };

  return (
    <div className="space-y-3">
      <Label>Social Links</Label>
      
      {/* Existing Links */}
      <div className="space-y-2">
        {links.map((link) => (
          <div
            key={link.id}
            className="flex items-center gap-2 p-2 rounded-lg"
            style={{
              background: 'rgba(255, 255, 255, 0.6)',
              border: '1px solid rgba(200, 200, 200, 0.3)',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
            }}
          >
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div className="text-gray-600 flex-shrink-0">
                <LinkIcon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:underline truncate block"
                >
                  {link.url}
                </a>
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleRemoveLink(link.id)}
              className="flex-shrink-0 text-gray-400 hover:text-red-500 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      {/* Add New Link */}
      {isAdding ? (
        <div
          className="p-3 rounded-lg space-y-2"
          style={{
            background: 'rgba(255, 255, 255, 0.8)',
            border: '1px solid rgba(200, 200, 200, 0.3)',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
          }}
        >
          <div>
            <Label className="text-xs">URL</Label>
            <Input
              value={newLink.url}
              onChange={(e) => setNewLink({ url: e.target.value })}
              placeholder="https://..."
              className="mt-1"
              autoFocus
              style={{
                background: 'rgba(255, 255, 255, 0.6)',
                border: '1px solid rgba(200, 200, 200, 0.3)',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                borderRadius: '8px',
                height: '28px',
                fontSize: '11px',
                padding: '6px 10px',
              }}
            />
          </div>

          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => {
                setIsAdding(false);
                setNewLink({ url: '' });
              }}
              style={{
                border: 'none',
                color: '#fff',
                backgroundImage: 'linear-gradient(30deg, #6b7280, #9ca3af)',
                backgroundColor: 'transparent',
                borderRadius: '15px',
                fontSize: '11px',
                padding: '0.3em 0.6em',
                cursor: 'pointer',
              }}
            >
              CANCEL
            </button>
            <button
              type="button"
              onClick={handleAddLink}
              disabled={!newLink.url.trim()}
              style={{
                border: 'none',
                color: '#fff',
                backgroundImage: 'linear-gradient(30deg, #0400ff, #4ce3f7)',
                backgroundColor: 'transparent',
                borderRadius: '15px',
                fontSize: '11px',
                padding: '0.3em 0.6em',
                cursor: newLink.url.trim() ? 'pointer' : 'not-allowed',
                opacity: newLink.url.trim() ? 1 : 0.5,
              }}
            >
              ADD
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setIsAdding(true)}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border-2 border-dashed border-gray-300 hover:border-blue-400 transition-colors text-gray-600 hover:text-blue-600"
        >
          <Plus className="w-4 h-4" />
          <span className="text-sm">Add Link</span>
        </button>
      )}
    </div>
  );
}


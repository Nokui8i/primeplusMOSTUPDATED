import React, { useState } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

interface TextPostCreatorProps {
  onPost: (content: string) => void;
  isSubmitting?: boolean;
}

export function TextPostCreator({ onPost, isSubmitting }: TextPostCreatorProps) {
  const [content, setContent] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (content.trim()) {
      onPost(content);
      setContent('');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="relative">
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="What's on your mind?"
          rows={3}
          className={cn(
            "w-full resize-none text-lg focus:ring-0",
            "placeholder:text-gray-500"
          )}
        />
      </div>
    </form>
  );
} 
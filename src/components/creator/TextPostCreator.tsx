import React, { useState } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Palette } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface TextPostCreatorProps {
  onPost: (content: string, background: string | null) => void;
  isSubmitting?: boolean;
}

const backgrounds = {
  gradients: [
    'bg-gradient-to-r from-rose-100 to-teal-100',
    'bg-gradient-to-r from-sky-400 to-blue-800',
    'bg-gradient-to-r from-pink-300 via-purple-300 to-indigo-400',
    'bg-gradient-to-r from-yellow-200 via-red-500 to-fuchsia-500',
    'bg-gradient-to-r from-green-200 via-green-400 to-purple-700',
    'bg-gradient-to-r from-rose-400 via-fuchsia-500 to-indigo-500',
    'bg-gradient-to-r from-sky-400 to-indigo-900',
    'bg-gradient-to-r from-yellow-200 via-green-200 to-green-500',
    'bg-gradient-to-r from-red-200 via-red-300 to-yellow-200',
  ],
  solid: [
    'bg-white',
    'bg-gray-100',
    'bg-black',
    'bg-pink-100',
    'bg-red-500',
    'bg-orange-500',
    'bg-amber-500',
    'bg-yellow-500',
    'bg-lime-500',
    'bg-green-500',
    'bg-emerald-500',
    'bg-teal-500',
    'bg-cyan-500',
    'bg-sky-500',
    'bg-blue-500',
    'bg-indigo-500',
    'bg-violet-500',
    'bg-purple-500',
    'bg-fuchsia-500',
    'bg-rose-500',
  ]
};

export function TextPostCreator({ onPost, isSubmitting }: TextPostCreatorProps) {
  const [content, setContent] = useState('');
  const [background, setBackground] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (content.trim()) {
      onPost(content, background);
      setContent('');
      setBackground(null);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="relative">
        <div className={cn(
          "flex justify-center rounded-xl transition-colors p-4 min-h-[120px]",
          background || 'bg-white'
        )}>
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="What's on your mind?"
            rows={3}
            className={cn(
              "w-full border-0 focus:ring-0 focus:outline-none resize-none text-center bg-transparent",
              "text-[20px] font-medium leading-relaxed tracking-[-0.01em]",
              "placeholder:text-[16px] placeholder:font-normal placeholder:text-gray-500/70",
              background ? "text-gray-800" : "text-gray-900"
            )}
            style={{ boxShadow: 'none' }}
          />
        </div>
        
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="absolute top-2 right-2 p-2 rounded-full bg-white hover:bg-gray-50 transition-colors border border-gray-200 shadow-sm"
            >
              <Palette className="w-4 h-4 text-gray-600" />
            </button>
          </PopoverTrigger>
          <PopoverContent 
            align="end" 
            className="w-64 p-3 max-h-[300px] overflow-y-auto"
          >
            <div className="space-y-4">
              <div>
                <div className="text-sm font-medium text-gray-700 mb-2">
                  Gradients
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {backgrounds.gradients.map((bg) => (
                    <button
                      key={bg}
                      type="button"
                      onClick={() => setBackground(bg)}
                      className={cn(
                        bg,
                        "w-12 h-12 rounded-lg border-2 transition-all hover:scale-105",
                        background === bg ? "border-pink-500 shadow-lg ring-2 ring-pink-200" : "border-transparent hover:border-pink-200"
                      )}
                    />
                  ))}
                </div>
              </div>

              <div>
                <div className="text-sm font-medium text-gray-700 mb-2">
                  Solid Colors
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setBackground(null)}
                    className={cn(
                      "w-12 h-12 rounded-lg bg-white border-2 transition-all hover:scale-105",
                      !background ? "border-pink-500 shadow-lg ring-2 ring-pink-200" : "border-gray-200 hover:border-pink-200"
                    )}
                  />
                  {backgrounds.solid.map((bg) => (
                    <button
                      key={bg}
                      type="button"
                      onClick={() => setBackground(bg)}
                      className={cn(
                        bg,
                        "w-12 h-12 rounded-lg border-2 transition-all hover:scale-105",
                        background === bg ? "border-pink-500 shadow-lg ring-2 ring-pink-200" : "border-transparent hover:border-pink-200"
                      )}
                    />
                  ))}
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <div className="flex justify-end">
        <Button
          type="submit"
          disabled={!content.trim() || isSubmitting}
          className="bg-pink-500 hover:bg-pink-600 text-white"
        >
          {isSubmitting ? 'Posting...' : 'Post'}
        </Button>
      </div>
    </form>
  );
} 
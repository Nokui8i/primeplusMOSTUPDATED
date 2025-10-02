'use client';

import { FiEdit2 } from 'react-icons/fi';

interface EditImageButtonProps {
  imageUrl: string;
  className?: string;
}

export default function EditImageButton({ imageUrl, className = '' }: EditImageButtonProps) {
  return (
    <button
      className={`p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors ${className}`}
      title="Edit image"
    >
      <FiEdit2 className="w-4 h-4" />
    </button>
  );
} 
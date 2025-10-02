import { useEffect, useState } from 'react';

export default function ImageEditorPage() {
  const [imageData, setImageData] = useState<string | null>(null);

  useEffect(() => {
    // Read image data from localStorage
    const data = localStorage.getItem('editorImageData');
    if (data) setImageData(data);
  }, []);

  if (!imageData) {
    return <div className="flex items-center justify-center h-screen text-lg text-gray-500">Loading image...</div>;
  }

  return (
    <div className="flex items-center justify-center h-screen text-lg text-gray-500">
      Image editing is not available at this time.
    </div>
  );
} 
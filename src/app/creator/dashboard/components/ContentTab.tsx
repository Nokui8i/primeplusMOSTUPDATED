'use client';

import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FiSearch, FiFilter, FiGrid, FiList, FiPlus, FiUpload } from 'react-icons/fi';
import { useAuth } from '@/lib/firebase/auth';
import ContentUpload from '@/components/creator/ContentUpload';

export default function ContentTab() {
  const { user } = useAuth();
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const handleUploadComplete = () => {
    // Handle the uploaded content data
    console.log('Upload completed');
    setIsUploadModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="relative">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search content..."
              className="pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <button className="p-2 hover:bg-gray-100 rounded-lg">
            <FiFilter className="text-gray-600" />
          </button>
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center bg-gray-100 rounded-lg p-1">
            <button
              className={`p-2 rounded-lg ${viewMode === 'grid' ? 'bg-white shadow' : ''}`}
              onClick={() => setViewMode('grid')}
            >
              <FiGrid className="text-gray-600" />
            </button>
            <button
              className={`p-2 rounded-lg ${viewMode === 'list' ? 'bg-white shadow' : ''}`}
              onClick={() => setViewMode('list')}
            >
              <FiList className="text-gray-600" />
            </button>
          </div>
          <button
            className="flex items-center space-x-2 bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600"
            onClick={() => setIsUploadModalOpen(true)}
          >
            <FiUpload />
            <span>Upload</span>
          </button>
        </div>
      </div>

      {/* Content Display */}
      <div className={viewMode === 'grid' ? 'grid grid-cols-3 gap-6' : 'space-y-4'}>
        {/* Sample content card - replace with actual content mapping */}
        <div className="bg-white rounded-lg shadow p-4">
          <div className="aspect-video bg-gray-100 rounded-lg mb-4"></div>
          <h3 className="font-semibold mb-2">Sample Content</h3>
          <p className="text-gray-600 text-sm">Posted 2 days ago</p>
        </div>
      </div>

      {/* Upload Modal */}
      <ContentUpload
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        userId={user?.uid || ''}
        onUploadComplete={handleUploadComplete}
      />
    </div>
  );
} 
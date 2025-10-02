import React, { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MapPin, X } from 'lucide-react';

interface LocationPickerProps {
  location: string | null;
  onLocationChange: (location: string | null) => void;
}

export function LocationPicker({ location, onLocationChange }: LocationPickerProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const handleLocationSelect = (selectedLocation: string) => {
    onLocationChange(selectedLocation);
    setOpen(false);
    setSearchQuery('');
  };

  const handleClearLocation = () => {
    onLocationChange(null);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="flex items-center gap-2"
        >
          <MapPin className="w-4 h-4" />
          {location ? (
            <span className="flex items-center gap-1">
              {location}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleClearLocation();
                }}
                className="ml-1 hover:text-red-500"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ) : (
            'Add Location'
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-4" align="start">
        <div className="space-y-4">
          <Input
            placeholder="Search for a location..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <div className="space-y-2">
            {/* In a real implementation, you would fetch locations from a geocoding service */}
            {searchQuery && (
              <button
                className="w-full p-2 text-left hover:bg-gray-100 rounded-md"
                onClick={() => handleLocationSelect(searchQuery)}
              >
                {searchQuery}
              </button>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
} 
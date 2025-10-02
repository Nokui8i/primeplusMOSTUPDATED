import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { X, Plus, Eye, EyeOff, MapPin, ExternalLink } from 'lucide-react';
import { Hotspot } from '@/types/vr';

interface HotspotEditorProps {
  src: string;
  type: 'image360' | 'video360';
  hotspots: Hotspot[];
  onHotspotsChange: (hotspots: Hotspot[]) => void;
  onClose: () => void;
}

export default function HotspotEditor({ 
  src, 
  type, 
  hotspots, 
  onHotspotsChange, 
  onClose 
}: HotspotEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [selectedHotspot, setSelectedHotspot] = useState<Hotspot | null>(null);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [showHotspots, setShowHotspots] = useState(true);
  const [hotspotTemplates, setHotspotTemplates] = useState([
    { id: 'room', text: 'Go to Room', color: '#4A90E2', icon: '🏠' },
    { id: 'kitchen', text: 'Enter Kitchen', color: '#FF6B6B', icon: '🍳' },
    { id: 'bedroom', text: 'View Bedroom', color: '#4ECDC4', icon: '🛏️' },
    { id: 'bathroom', text: 'Bathroom', color: '#45B7D1', icon: '🚿' },
    { id: 'living', text: 'Living Room', color: '#96CEB4', icon: '🛋️' },
    { id: 'balcony', text: 'Balcony View', color: '#FFEAA7', icon: '🌅' },
    { id: 'info', text: 'More Info', color: '#DDA0DD', icon: 'ℹ️' }
  ]);
  const vrViewRef = useRef<HTMLDivElement>(null);
  const [mousePosition, setMousePosition] = useState<{ x: number; y: number } | null>(null);

  // Convert mouse position to 3D coordinates
  const get3DPosition = (x: number, y: number) => {
    // Simple conversion - in a real implementation, you'd use proper 3D math
    const normalizedX = (x / (vrViewRef.current?.clientWidth || 1)) * 2 - 1;
    const normalizedY = -((y / (vrViewRef.current?.clientHeight || 1)) * 2 - 1);
    
    // Convert to spherical coordinates for 360° content
    const radius = 2; // Distance from center
    const theta = normalizedX * Math.PI; // Horizontal angle
    const phi = Math.acos(normalizedY); // Vertical angle
    
    const posX = radius * Math.sin(phi) * Math.cos(theta);
    const posY = radius * Math.cos(phi);
    const posZ = radius * Math.sin(phi) * Math.sin(theta);
    
    return `${posX.toFixed(2)} ${posY.toFixed(2)} ${posZ.toFixed(2)}`;
  };

  const handleMouseClick = (e: React.MouseEvent) => {
    if (!isEditing) return;
    
    const rect = vrViewRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const position = get3DPosition(x, y);
    
    // Use first template as default
    const template = hotspotTemplates[0];
    const newHotspot: Hotspot = {
      id: `hotspot_${Date.now()}`,
      position,
      text: template.text,
      color: template.color,
      size: 0.2
    };
    
    onHotspotsChange([...hotspots, newHotspot]);
    setSelectedHotspot(newHotspot);
    setIsEditing(false);
  };

  const addTemplateHotspot = (template: any) => {
    if (!isEditing) return;
    
    // Add hotspot at center of view
    const position = "0 0 2"; // Center position
    const newHotspot: Hotspot = {
      id: `hotspot_${Date.now()}`,
      position,
      text: template.text,
      color: template.color,
      size: 0.2
    };
    
    onHotspotsChange([...hotspots, newHotspot]);
    setSelectedHotspot(newHotspot);
    setIsEditing(false);
  };

  const handleHotspotClick = (hotspot: Hotspot) => {
    setSelectedHotspot(hotspot);
  };

  const handleHotspotUpdate = (updatedHotspot: Hotspot) => {
    const updatedHotspots = hotspots.map(h => 
      h.id === updatedHotspot.id ? updatedHotspot : h
    );
    onHotspotsChange(updatedHotspots);
    setSelectedHotspot(updatedHotspot);
  };

  const handleHotspotDelete = (hotspotId: string) => {
    const updatedHotspots = hotspots.filter(h => h.id !== hotspotId);
    onHotspotsChange(updatedHotspots);
    setSelectedHotspot(null);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isEditing) return;
    
    const rect = vrViewRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setMousePosition({ x, y });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 z-50 flex">
      {/* VR Preview */}
      <div className="flex-1 relative">
        <div 
          ref={vrViewRef}
          className="w-full h-full relative cursor-crosshair"
          onClick={handleMouseClick}
          onMouseMove={handleMouseMove}
        >
          {/* VR Content */}
          <div className="w-full h-full">
            {type === 'image360' ? (
              <img 
                src={src} 
                alt="360° Image" 
                className="w-full h-full object-cover"
                style={{ transform: 'scaleX(-1)' }}
              />
            ) : (
              <video 
                src={src} 
                className="w-full h-full object-cover"
                style={{ transform: 'scaleX(-1)' }}
                autoPlay
                loop
                muted
              />
            )}
          </div>
          
          {/* Hotspot Markers */}
          {showHotspots && hotspots.map((hotspot) => (
            <div
              key={hotspot.id}
              className="absolute w-4 h-4 bg-blue-500 rounded-full cursor-pointer hover:scale-110 transition-transform"
              style={{
                left: '50%',
                top: '50%',
                transform: 'translate(-50%, -50%)',
                backgroundColor: hotspot.color,
                width: `${(hotspot.size || 0.2) * 100}px`,
                height: `${(hotspot.size || 0.2) * 100}px`,
              }}
              onClick={(e) => {
                e.stopPropagation();
                handleHotspotClick(hotspot);
              }}
            >
              <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 bg-black text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                {hotspot.text}
              </div>
            </div>
          ))}
          
          {/* Editing Cursor */}
          {isEditing && mousePosition && (
            <div 
              className="absolute w-4 h-4 border-2 border-yellow-400 rounded-full pointer-events-none"
              style={{
                left: mousePosition.x - 8,
                top: mousePosition.y - 8,
              }}
            />
          )}
        </div>
        
        {/* Overlay Controls */}
        <div className="absolute top-4 left-4 flex space-x-2">
          <Button
            variant={isEditing ? "destructive" : "default"}
            size="sm"
            onClick={() => setIsEditing(!isEditing)}
          >
            {isEditing ? 'Cancel' : 'Add Hotspot'}
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowHotspots(!showHotspots)}
          >
            {showHotspots ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </Button>
        </div>
        
        {/* Instructions */}
        {isEditing && (
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-70 text-white px-4 py-2 rounded-lg">
            Click anywhere to add a hotspot
          </div>
        )}
      </div>
      
      {/* Hotspot Editor Panel */}
      <div className="w-80 bg-white border-l overflow-y-auto">
        <div className="p-4 border-b">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Hotspot Editor</h3>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
          <p className="text-sm text-gray-600 mt-1">
            Add interactive points to your 360° content
          </p>
        </div>
        
        <div className="p-4 space-y-4">
          {/* Room Templates */}
          <div>
            <Label className="text-sm font-medium mb-2 block">Room Navigation</Label>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {hotspotTemplates.map((template) => (
                <button
                  key={template.id}
                  onClick={() => addTemplateHotspot(template)}
                  className="flex items-center space-x-2 p-2 text-xs rounded border hover:bg-gray-50 transition-colors"
                  disabled={!isEditing}
                >
                  <span className="text-lg">{template.icon}</span>
                  <span className="flex-1 text-left">{template.text}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Hotspot List */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-sm font-medium">Hotspots ({hotspots.length})</Label>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditing(true)}
              >
                <Plus className="w-4 h-4 mr-1" />
                Add
              </Button>
            </div>
            
            <div className="space-y-2">
              {hotspots.map((hotspot) => (
                <Card 
                  key={hotspot.id}
                  className={`cursor-pointer transition-colors ${
                    selectedHotspot?.id === hotspot.id ? 'ring-2 ring-blue-500' : ''
                  }`}
                  onClick={() => handleHotspotClick(hotspot)}
                >
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <div 
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: hotspot.color }}
                          />
                          <span className="text-sm font-medium">{hotspot.text}</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          Position: {hotspot.position}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleHotspotDelete(hotspot.id);
                        }}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
              
              {hotspots.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <MapPin className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No hotspots added yet</p>
                  <p className="text-xs">Click "Add" to create your first hotspot</p>
                </div>
              )}
            </div>
          </div>
          
          {/* Hotspot Editor */}
          {selectedHotspot && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Edit Hotspot</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="hotspot-text">Text</Label>
                  <Input
                    id="hotspot-text"
                    value={selectedHotspot.text}
                    onChange={(e) => handleHotspotUpdate({
                      ...selectedHotspot,
                      text: e.target.value
                    })}
                    placeholder="Enter hotspot text"
                  />
                </div>
                
                <div>
                  <Label htmlFor="hotspot-url">URL (optional)</Label>
                  <Input
                    id="hotspot-url"
                    value={selectedHotspot.url || ''}
                    onChange={(e) => handleHotspotUpdate({
                      ...selectedHotspot,
                      url: e.target.value
                    })}
                    placeholder="https://example.com"
                  />
                </div>
                
                <div>
                  <Label htmlFor="hotspot-color">Color</Label>
                  <div className="flex space-x-2">
                    {['#4A90E2', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7'].map((color) => (
                      <button
                        key={color}
                        className={`w-8 h-8 rounded-full border-2 ${
                          selectedHotspot.color === color ? 'border-gray-800' : 'border-gray-300'
                        }`}
                        style={{ backgroundColor: color }}
                        onClick={() => handleHotspotUpdate({
                          ...selectedHotspot,
                          color
                        })}
                      />
                    ))}
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="hotspot-size">Size</Label>
                  <Input
                    id="hotspot-size"
                    type="range"
                    min="0.1"
                    max="0.5"
                    step="0.1"
                    value={selectedHotspot.size || 0.2}
                    onChange={(e) => handleHotspotUpdate({
                      ...selectedHotspot,
                      size: parseFloat(e.target.value)
                    })}
                  />
                  <p className="text-xs text-gray-500">
                    Size: {((selectedHotspot.size || 0.2) * 100).toFixed(0)}%
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

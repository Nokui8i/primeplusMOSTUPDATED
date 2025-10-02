import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StreamScheduleManager } from '@/lib/streaming/schedule-manager';
import { toast } from 'sonner';

interface ScheduleStreamDialogProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
}

export function ScheduleStreamDialog({ isOpen, onClose, userId }: ScheduleStreamDialogProps) {
  const [isScheduling, setIsScheduling] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [streamData, setStreamData] = useState({
    title: '',
    description: '',
    duration: 60, // default 1 hour
    isPublic: true,
    quality: 'auto' as const,
  });

  const handleSchedule = async () => {
    if (!selectedDate) {
      toast.error('Please select a date and time');
      return;
    }

    try {
      setIsScheduling(true);
      const scheduleManager = new StreamScheduleManager(userId);
      
      await scheduleManager.scheduleStream({
        ...streamData,
        scheduledFor: selectedDate,
      });

      toast.success('Stream scheduled successfully!');
      onClose();
    } catch (error) {
      console.error('Error scheduling stream:', error);
      toast.error('Failed to schedule stream');
    } finally {
      setIsScheduling(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Schedule Stream</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <Label>Title</Label>
            <Input
              value={streamData.title}
              onChange={(e) => setStreamData({ ...streamData, title: e.target.value })}
              placeholder="Enter stream title"
            />
          </div>

          <div>
            <Label>Description</Label>
            <Textarea
              value={streamData.description}
              onChange={(e) => setStreamData({ ...streamData, description: e.target.value })}
              placeholder="Enter stream description"
            />
          </div>

          <div>
            <Label>Date & Time</Label>
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              className="rounded-md border"
            />
            <Input
              type="time"
              value={selectedDate?.toTimeString().slice(0, 5) || ''}
              onChange={(e) => {
                if (selectedDate) {
                  const [hours, minutes] = e.target.value.split(':');
                  const newDate = new Date(selectedDate);
                  newDate.setHours(parseInt(hours), parseInt(minutes));
                  setSelectedDate(newDate);
                }
              }}
              className="mt-2"
            />
          </div>

          <div>
            <Label>Duration (minutes)</Label>
            <Input
              type="number"
              value={streamData.duration}
              onChange={(e) => setStreamData({ ...streamData, duration: parseInt(e.target.value) })}
              min={15}
              max={480} // 8 hours max
            />
          </div>

          <div>
            <Label>Stream Quality</Label>
            <Select
              value={streamData.quality}
              onValueChange={(value: typeof streamData.quality) => 
                setStreamData({ ...streamData, quality: value })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select quality" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto (Recommended)</SelectItem>
                <SelectItem value="4k">4K (3840x2160)</SelectItem>
                <SelectItem value="2k">2K (2560x1440)</SelectItem>
                <SelectItem value="1080p">1080p (1920x1080)</SelectItem>
                <SelectItem value="720p">720p (1280x720)</SelectItem>
                <SelectItem value="480p">480p (854x480)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <Label>Public Stream</Label>
            <Switch
              checked={streamData.isPublic}
              onCheckedChange={(checked) => setStreamData({ ...streamData, isPublic: checked })}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleSchedule} 
            disabled={isScheduling || !streamData.title || !selectedDate}
          >
            {isScheduling ? 'Scheduling...' : 'Schedule Stream'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
} 
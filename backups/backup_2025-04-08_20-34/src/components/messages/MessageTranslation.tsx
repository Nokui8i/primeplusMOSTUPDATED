import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FiGlobe } from 'react-icons/fi';
import { messagesService } from '@/lib/services/messages';
import { useToast } from '@/hooks/use-toast';

interface MessageTranslationProps {
  messageId: string;
  content: string;
  translations?: Record<string, string>;
}

const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'it', name: 'Italian' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'ru', name: 'Russian' },
  { code: 'zh', name: 'Chinese' },
  { code: 'ja', name: 'Japanese' },
  { code: 'ko', name: 'Korean' },
];

export function MessageTranslation({ messageId, content, translations = {} }: MessageTranslationProps) {
  const [selectedLanguage, setSelectedLanguage] = useState<string>('');
  const [isTranslating, setIsTranslating] = useState(false);
  const { toast } = useToast();

  const handleTranslate = async () => {
    if (!selectedLanguage) return;

    setIsTranslating(true);
    try {
      await messagesService.translateMessage(messageId, selectedLanguage);
      
      toast({
        title: 'Message translated',
        description: `Message has been translated to ${
          LANGUAGES.find(lang => lang.code === selectedLanguage)?.name
        }`,
      });
    } catch (error) {
      toast({
        title: 'Translation failed',
        description: 'Failed to translate message. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsTranslating(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Select
          value={selectedLanguage}
          onValueChange={setSelectedLanguage}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select language" />
          </SelectTrigger>
          <SelectContent>
            {LANGUAGES.map((language) => (
              <SelectItem
                key={language.code}
                value={language.code}
              >
                {language.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        <Button
          variant="outline"
          size="icon"
          onClick={handleTranslate}
          disabled={!selectedLanguage || isTranslating}
        >
          <FiGlobe className={isTranslating ? 'animate-spin' : ''} />
        </Button>
      </div>
      
      {Object.entries(translations).map(([langCode, translatedText]) => (
        <div
          key={langCode}
          className="p-2 rounded-md bg-muted text-sm"
        >
          <div className="text-xs text-muted-foreground mb-1">
            {LANGUAGES.find(lang => lang.code === langCode)?.name}
          </div>
          {translatedText}
        </div>
      ))}
    </div>
  );
} 
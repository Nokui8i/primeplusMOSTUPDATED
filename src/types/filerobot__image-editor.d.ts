declare module '@filerobot/image-editor' {
  export const TABS: {
    ADJUST: string;
    FINETUNE: string;
    FILTERS: string;
    ANNOTATE: string;
    WATERMARK: string;
    RESIZE: string;
    CROP: string;
  };

  export const TOOLS: {
    TEXT: string;
    DRAW: string;
    HIGHLIGHT: string;
    BLUR: string;
    CROP: string;
    ROTATE: string;
    FLIP: string;
  };

  export interface FilerobotImageEditorProps {
    source: string;
    tabsIds?: string[];
    defaultTabId?: string;
    defaultToolId?: string;
    translations?: Record<string, Record<string, string>>;
    theme?: {
      palette?: {
        'bg-primary'?: string;
        'bg-secondary'?: string;
        'accent-primary'?: string;
        'accent-secondary'?: string;
        'text-primary'?: string;
        'text-secondary'?: string;
      };
    };
    onSave?: (imageData: { imageBase64: string }) => void;
    onClose?: () => void;
  }

  export class FilerobotImageEditor extends React.Component<FilerobotImageEditorProps> {
    getCurrentImgData(): Promise<{ imageBase64: string }>;
  }
} 
declare module '@toast-ui/react-image-editor' {
  import { Component } from 'react';

  interface ImageEditorProps {
    includeUI?: {
      loadImage?: {
        path: string;
        name: string;
      };
      theme?: Record<string, any>;
      menu?: string[];
      initMenu?: string;
      uiSize?: {
        width: string;
        height: string;
      };
      menuBarPosition?: 'top' | 'bottom';
    };
    cssMaxHeight?: number;
    cssMaxWidth?: number;
    selectionStyle?: {
      cornerSize: number;
      rotatingPointOffset: number;
    };
    usageStatistics?: boolean;
  }

  export default class ImageEditor extends Component<ImageEditorProps> {
    getInstance(): {
      toDataURL(): string;
    };
  }
} 
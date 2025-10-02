import 'react';

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'a-scene': any;
      'a-assets': any;
      'a-videosphere': any;
      'a-sky': any;
      'a-camera': any;
      'a-entity': any;
    }
  }
}
export {}; 
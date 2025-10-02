'use client';

import { useEffect } from 'react';
import { initializeWebGL, checkWebGLSupport } from '@/lib/utils/webgl';

export function WebGLInitializer() {
  useEffect(() => {
    // Initialize WebGL before rendering the app
    const webglSupported = initializeWebGL();
    if (!webglSupported) {
      console.warn('WebGL initialization failed, some features may be limited');
    }

    // Check WebGL support and capabilities
    const hasWebGL = checkWebGLSupport();
    if (!hasWebGL) {
      console.warn('WebGL is not supported in this browser, some features may be limited');
    }
  }, []);

  return null;
} 
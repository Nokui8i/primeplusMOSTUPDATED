export function initializeWebGL() {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    
    if (!gl) {
      console.warn('WebGL not supported, falling back to software rendering');
      return false;
    }

    // Check for WebGL2 support
    const isWebGL2 = gl instanceof WebGL2RenderingContext;
    
    // Set up WebGL context attributes
    const contextAttributes = {
      alpha: false,
      antialias: true,
      depth: true,
      desynchronized: false,
      failIfMajorPerformanceCaveat: false,
      powerPreference: 'high-performance',
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
      stencil: false,
      xrCompatible: false
    };

    // Create a new context with the specified attributes
    const newCanvas = document.createElement('canvas');
    const newGl = newCanvas.getContext('webgl2', contextAttributes) || 
                 newCanvas.getContext('webgl', contextAttributes);

    if (!newGl) {
      console.warn('Failed to create WebGL context with specified attributes');
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error initializing WebGL:', error);
    return false;
  }
}

export function checkWebGLSupport() {
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
  
  if (!gl) {
    console.warn('WebGL is not supported in this browser');
    return false;
  }

  const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
  if (debugInfo) {
    const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
    console.log('WebGL Renderer:', renderer);
  }

  return true;
} 
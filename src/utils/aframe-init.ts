
let isAFrameInitialized = false;

export const initAFrame = () => {
  if (typeof window === 'undefined' || isAFrameInitialized) {
    return;
  }

  if (!window.AFRAME) {
    require('aframe');
    isAFrameInitialized = true;
  }
};

export const isAFrameLoaded = () => {
  return isAFrameInitialized || (typeof window !== 'undefined' && !!window.AFRAME);
}; 
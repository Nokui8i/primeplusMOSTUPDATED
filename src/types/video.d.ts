declare module 'video.js' {
  const videojs: any;
  export default videojs;
}

declare module '*.css' {
  const content: { [className: string]: string };
  export default content;
}

declare module 'videojs-vr' {
  const videojsVR: any;
  export default videojsVR;
} 
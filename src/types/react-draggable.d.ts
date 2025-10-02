declare module 'react-draggable' {
  import { Component } from 'react';
  
  interface DraggableProps {
    children: React.ReactNode;
    defaultPosition?: { x: number; y: number };
    position?: { x: number; y: number };
    onStart?: (e: any, data: any) => void;
    onDrag?: (e: any, data: any) => void;
    onStop?: (e: any, data: any) => void;
    disabled?: boolean;
    bounds?: string | { left?: number; right?: number; top?: number; bottom?: number };
    handle?: string;
    cancel?: string;
    grid?: [number, number];
    scale?: number;
    [key: string]: any;
  }
  
  export default class Draggable extends Component<DraggableProps> {}
}

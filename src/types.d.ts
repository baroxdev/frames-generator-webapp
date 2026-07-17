import React from 'react';

export interface ObjectLayer {
  content?: string;
  width: number;
  height: number;
  limit?: number;
  x: number;
  y: number;
  isDev?: boolean;
  style?: React.CSSProperties;
  /** CSS color for the box's text. Omit to keep the component's current default. */
  textColor?: string;
}

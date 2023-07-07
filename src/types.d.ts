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
}

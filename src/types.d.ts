import React from 'react';
import type { CustomFont } from './templates/types';

export interface ObjectLayer {
  content?: string;
  width: number;
  height: number;
  limit?: number;
  x: number;
  y: number;
  isDev?: boolean;
  style?: React.CSSProperties;
  textColor?: string;
  autoFit?: boolean;
  fontFamily?: string;
  /** Set when `fontFamily` is a campaign owner's own uploaded font — see `CustomFont` in `src/templates/types.ts`. */
  customFont?: CustomFont;
  /** Only meaningful on Name/Role — see `Template.showFieldPrefix` in `src/templates/types.ts`. */
  showPrefix?: boolean;
}

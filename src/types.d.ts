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
  /** Opt-in continuous auto-fit sizing — see `TextBoxConfig.autoFit` in `src/templates/types.ts`. Omit/false keeps today's `limit`-based two-tier shrink behavior. */
  autoFit?: boolean;
}

import clsx from 'clsx';
import { useMemo } from 'react';

import { ObjectLayer } from '../types';
import { fitTextFontSize } from '../utils/fitTextToBox';
import { measureTextWidth } from '../utils/measureText';
import { fontAtSize, MESSAGE_FONT_TEMPLATE } from '../utils/textFonts';

// However large the message box is, the tribute message never renders
// larger than this — a big box shouldn't blow the message up to
// billboard-sized text just because there's room.
const MAX_AUTO_FIT_FONT_SIZE = 150;

/** `autoFit` (opt-in) replaces the length-based two-tier shrink below with a continuous, word-wrap-aware font size fit to this box's own width/height and content length — see Name.tsx/Role.tsx, which use the same mechanism in single-line mode. */
const Message = ({ content, height, width, x, y, isDev, textColor, autoFit }: ObjectLayer) => {
  const defaultMessage = 'Thông điệp của bạn';
  const message = content || defaultMessage;

  const autoFitSize = useMemo(() => {
    if (!autoFit) return null;
    return fitTextFontSize({
      text: message,
      box: { width, height },
      multiline: true,
      maxFontSize: MAX_AUTO_FIT_FONT_SIZE,
      measure: (text, fontSizePx) => measureTextWidth(text, fontAtSize(MESSAGE_FONT_TEMPLATE, fontSizePx)),
    });
  }, [autoFit, message, width, height]);

  const limit = 150;
  const lte = message.length < limit;
  const gte = message.length > limit;

  return (
    <div
      className={clsx('absolute ', {
        'flex items-center justify-center': autoFit || lte,
        'bg-transparent': !isDev,
        'bg-black text-white': isDev,
      })}
      style={{
        width: width,
        height: height,
        top: x - 15,
        left: y,
        fontFamily: `'Lobster', cursive`,
      }}
    >
      <p
        className={clsx('font-medium', {
          'text-3xl ': !autoFit && gte,
          'text-5xl text-center': !autoFit && lte,
          'text-center': autoFit,
          'text-blue-900': !textColor,
        })}
        style={{
          ...(textColor ? { color: textColor } : undefined),
          ...(autoFitSize ? { fontSize: `${autoFitSize}px`, lineHeight: 1.2 } : undefined),
        }}
      >
        {message}
      </p>
    </div>
  );
};

export default Message;

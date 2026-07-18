import { forwardRef, useEffect, useId, useImperativeHandle, useRef } from 'react';

type TurnstileRenderOptions = {
  sitekey: string;
  callback: (token: string) => void;
  'expired-callback'?: () => void;
  'error-callback'?: () => void;
  /** Echoed back in siteverify's response so a server can confirm the token was solved for this specific action (see submit-tribute's Turnstile check). */
  action?: string;
};

declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement, options: TurnstileRenderOptions) => string;
      remove: (widgetId: string) => void;
      reset: (widgetId: string) => void;
    };
  }
}

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
let scriptLoadPromise: Promise<void> | null = null;

function loadTurnstileScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  if (scriptLoadPromise) return scriptLoadPromise;

  scriptLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Không thể tải CAPTCHA. Vui lòng kiểm tra kết nối mạng.'));
    document.head.appendChild(script);
  });

  return scriptLoadPromise;
}

type TurnstileWidgetProps = {
  siteKey: string;
  onVerify: (token: string) => void;
  onExpire?: () => void;
  onError?: () => void;
  /** Passed through to Turnstile's `action` render option — set this when a server needs to verify the token was solved for a specific action (e.g. `submit-tribute`), not just anywhere on the site. */
  action?: string;
};

/** Imperative handle so callers can force a fresh challenge (Turnstile tokens are single-use — a failed submit must reset the widget before retrying). */
export type TurnstileWidgetHandle = {
  reset: () => void;
};

/**
 * Renders a Cloudflare Turnstile CAPTCHA challenge. This component only
 * collects the token — verification happens server-side wherever it's
 * consumed: Supabase Auth verifies it directly when passed as
 * `captchaToken` to `signUp`, while the visitor submission flow (#6) sends
 * it to the `submit-tribute` Edge Function, which calls Cloudflare's
 * siteverify API itself.
 */
export const TurnstileWidget = forwardRef<TurnstileWidgetHandle, TurnstileWidgetProps>(function TurnstileWidget(
  { siteKey, onVerify, onExpire, onError, action },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const elementId = useId();

  useImperativeHandle(
    ref,
    () => ({
      reset: () => {
        if (widgetIdRef.current && window.turnstile) {
          window.turnstile.reset(widgetIdRef.current);
        }
      },
    }),
    [],
  );

  useEffect(() => {
    let cancelled = false;

    loadTurnstileScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.turnstile) return;
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          callback: onVerify,
          'expired-callback': onExpire,
          'error-callback': onError,
          action,
        });
      })
      .catch(() => onError?.());

    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
    // Re-render is only ever needed if the site key itself changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteKey]);

  return <div ref={containerRef} id={`turnstile-widget-${elementId}`} />;
});

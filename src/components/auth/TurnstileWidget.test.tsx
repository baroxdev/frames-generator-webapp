import { render, waitFor } from '@testing-library/react';
import { createRef } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TurnstileWidget, type TurnstileWidgetHandle } from './TurnstileWidget';

describe('TurnstileWidget', () => {
  let mockTurnstile: NonNullable<Window['turnstile']>;

  beforeEach(() => {
    // Pre-set window.turnstile so the component's script-loading short-circuit
    // (`if (window.turnstile) return Promise.resolve()`) skips the real
    // Cloudflare script entirely.
    mockTurnstile = {
      render: vi.fn().mockReturnValue('widget-1'),
      remove: vi.fn(),
      reset: vi.fn(),
    };
    window.turnstile = mockTurnstile;
  });

  it('renders with the given site key and forwards verification to onVerify', async () => {
    const onVerify = vi.fn();
    render(<TurnstileWidget siteKey="test-site-key" onVerify={onVerify} />);

    await waitFor(() => expect(mockTurnstile.render).toHaveBeenCalledTimes(1));

    const renderOptions = vi.mocked(mockTurnstile.render).mock.calls[0][1];
    expect(renderOptions.sitekey).toBe('test-site-key');

    renderOptions.callback('captcha-token');
    expect(onVerify).toHaveBeenCalledWith('captcha-token');
  });

  it('exposes reset() through its ref that resets the underlying widget', async () => {
    const ref = createRef<TurnstileWidgetHandle>();
    render(<TurnstileWidget ref={ref} siteKey="test-site-key" onVerify={vi.fn()} />);

    await waitFor(() => expect(mockTurnstile.render).toHaveBeenCalledTimes(1));

    ref.current?.reset();

    expect(mockTurnstile.reset).toHaveBeenCalledWith('widget-1');
  });
});

import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// jsdom doesn't implement matchMedia; antd's <Row>/<Col> grid uses it for
// responsive breakpoints on mount, so every antd-form-based component test
// needs this polyfill or it throws during the effect phase.
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  }),
});

// Unmounts anything rendered by the previous test so component tests never
// leak DOM nodes (or duplicate event listeners) into the next one.
afterEach(() => {
  cleanup();
});

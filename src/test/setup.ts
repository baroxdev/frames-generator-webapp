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

// jsdom doesn't implement URL.createObjectURL/revokeObjectURL; components
// that preview a locally-chosen file (e.g. NewCampaignPage's background
// upload) need this polyfill or they throw during the effect phase.
if (!URL.createObjectURL) {
  URL.createObjectURL = () => 'blob:mock-object-url';
}
if (!URL.revokeObjectURL) {
  URL.revokeObjectURL = () => undefined;
}

// jsdom doesn't implement ResizeObserver; antd's <Menu> (overflow
// calculation) and <Table> both observe their container's size on mount, so
// any test rendering them needs this polyfill or it throws during the
// effect phase.
if (!window.ResizeObserver) {
  window.ResizeObserver = class ResizeObserver {
    observe = () => undefined;
    unobserve = () => undefined;
    disconnect = () => undefined;
  };
}

// Unmounts anything rendered by the previous test so component tests never
// leak DOM nodes (or duplicate event listeners) into the next one.
afterEach(() => {
  cleanup();
});

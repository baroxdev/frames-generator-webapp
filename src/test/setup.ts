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

// Components that preview a locally-chosen file (e.g. NewCampaignPage's
// background upload) call URL.createObjectURL and assert on its result.
// jsdom itself doesn't implement it, but Node's own global URL now does
// (returns non-deterministic "blob:nodedata:..." URLs) — override
// unconditionally so tests get the same deterministic value regardless of
// which runtime under-the-hood already defines it.
URL.createObjectURL = () => 'blob:mock-object-url';
URL.revokeObjectURL = () => undefined;

// jsdom defines window.scrollTo but throws "not implemented" when called;
// TanStack Router's scroll restoration calls it on every route match, so
// override unconditionally (a presence check isn't enough — see
// URL.createObjectURL above for the same pattern).
window.scrollTo = () => undefined;

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

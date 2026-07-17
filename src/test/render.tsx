import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, type RenderOptions } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';

type RenderWithProvidersOptions = { route?: string } & Omit<RenderOptions, 'wrapper'>;

/**
 * Shared render helper for auth page/component tests: wraps `ui` in a fresh
 * `QueryClient` (retries disabled so failed mutations reject immediately
 * instead of retrying in the background) and a `MemoryRouter`, mirroring the
 * providers `main.tsx` sets up at the real app root.
 */
export function renderWithProviders(ui: ReactElement, options: RenderWithProvidersOptions = {}) {
  const { route = '/', ...renderOptions } = options;
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>
      </QueryClientProvider>
    );
  }

  return { queryClient, ...render(ui, { wrapper: Wrapper, ...renderOptions }) };
}

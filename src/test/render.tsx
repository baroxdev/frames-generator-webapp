import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import { act, render, type RenderOptions } from '@testing-library/react';
import type { ReactElement } from 'react';

type RenderWithProvidersOptions = {
  /** Concrete URL the memory history starts at, e.g. '/campaigns/123/edit'. */
  route?: string;
  /** Route pattern `ui` is mounted at, e.g. '/campaigns/$id/edit'. Defaults to `route` (no dynamic segments). */
  path?: string;
  /**
   * Extra sibling routes a test needs reachable — typically a redirect
   * target, e.g. `[{ path: '/login', element: <div>login-placeholder</div> }]`
   * so a component's `<Navigate to="/login" />` has somewhere to land.
   */
  additionalRoutes?: { path: string; element: ReactElement }[];
} & Omit<RenderOptions, 'wrapper'>;

/**
 * Shared render helper for page/component tests: wraps `ui` in a fresh
 * `QueryClient` (retries disabled so failed mutations reject immediately
 * instead of retrying in the background) and a real TanStack Router
 * instance (memory history), mirroring the providers the real app root sets
 * up. A real router is used — rather than mocking `useParams`/`useNavigate`
 * — because those hooks require an actual route match to resolve.
 *
 * Async: the router resolves its initial match asynchronously even with no
 * loaders (a microtask, not a real fetch) — callers must `await` this or the
 * component won't have rendered yet when the next line runs.
 */
export async function renderWithProviders(ui: ReactElement, options: RenderWithProvidersOptions = {}) {
  const { route = '/', path = route, additionalRoutes = [], ...renderOptions } = options;
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  const rootRoute = createRootRoute();
  const testRoute = createRoute({
    getParentRoute: () => rootRoute,
    path,
    component: () => ui,
  });
  const extraRoutes = additionalRoutes.map(({ path: extraPath, element }) =>
    createRoute({ getParentRoute: () => rootRoute, path: extraPath, component: () => element }),
  );
  const router = createRouter({
    routeTree: rootRoute.addChildren([testRoute, ...extraRoutes]),
    history: createMemoryHistory({ initialEntries: [route] }),
    defaultPendingMinMs: 0,
  });

  function Wrapper() {
    return (
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    );
  }

  let result!: ReturnType<typeof render>;
  await act(async () => {
    result = render(<Wrapper />, renderOptions);
    await router.load();
  });

  return { queryClient, router, ...result };
}

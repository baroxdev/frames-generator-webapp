import { useMemo } from 'react';
import { getEnv, type Env } from './env';

/** React-friendly wrapper around `getEnv()` that turns the fail-fast throw into state a component can render around. */
export function useEnv(): { env: Env | null; error: string | null } {
  return useMemo(() => {
    try {
      return { env: getEnv(), error: null };
    } catch (error) {
      return { env: null, error: error instanceof Error ? error.message : 'Cấu hình không hợp lệ.' };
    }
  }, []);
}

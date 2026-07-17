import { createStorageService, type StorageService } from './storage.service';
import { getSupabaseClient } from '../lib/supabase-client';

let cachedInstance: StorageService | null = null;

/**
 * The app's single `StorageService` instance, wired to the real Supabase
 * client. Kept separate from `storage.service.ts` so that module stays free
 * of any dependency on env/config — tests import `createStorageService`
 * directly and inject a mock client instead of going through this singleton.
 */
export function getStorageService(): StorageService {
  if (!cachedInstance) {
    cachedInstance = createStorageService(getSupabaseClient());
  }
  return cachedInstance;
}

import { message } from 'antd';
import { AuthServiceError } from '../services/auth.service';

/**
 * Shared catch-block handler for auth mutations across the sign-up, login,
 * forgot-password, reset-password, and account pages: shows the
 * service's friendly message when there is one, otherwise a page-specific
 * fallback for anything unexpected (network errors, etc.).
 */
export function reportAuthError(error: unknown, fallbackMessage: string): void {
  const friendlyMessage = error instanceof AuthServiceError ? error.message : fallbackMessage;
  message.error(friendlyMessage);
}

import type { ZodError } from 'zod';

/** Flattens a ZodError into { field: firstErrorMessage } for driving form UI state. */
export function fieldErrorsFromZod<T extends string>(error: ZodError): Partial<Record<T, string>> {
  const flattened = error.flatten().fieldErrors as Record<string, string[] | undefined>;

  return Object.keys(flattened).reduce<Partial<Record<T, string>>>((accumulated, key) => {
    const messages = flattened[key];
    if (!messages || messages.length === 0) return accumulated;
    return { ...accumulated, [key]: messages[0] };
  }, {});
}

import { createWriteStream, mkdirSync, openSync } from 'node:fs';
import { dirname } from 'node:path';

export function logStream(file) {
  if (!file) return undefined;
  mkdirSync(dirname(file), { recursive: true });
  // Open synchronously so an unwritable mount fails at startup rather than losing request logs.
  return createWriteStream(file, { fd: openSync(file, 'a') });
}

export function logParameters(value) {
  if (Array.isArray(value)) return value.map(logParameters);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) =>
    [key, /cookie|authorization|password|token|secret|credential|access.?key/i.test(key) ? '[REDACTED]' : logParameters(item)]));
  return value;
}

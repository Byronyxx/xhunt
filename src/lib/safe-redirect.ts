/**
 * Returns `candidate` (as path + search + hash) only if it is a safe,
 * same-origin, root-relative path. Otherwise returns `fallback`.
 * Pure: no browser globals; the origin is passed in.
 */
export function safeRedirectPath(
  candidate: string | null | undefined,
  fallback: string,
  origin: string,
): string {
  if (typeof candidate !== 'string') return fallback;
  // Must start with exactly one '/'.
  if (candidate.charAt(0) !== '/') return fallback;
  const second = candidate.charAt(1);
  if (second === '/' || second === '\\') return fallback;
  // No backslashes anywhere.
  if (candidate.includes('\\')) return fallback;
  // No ASCII control characters (0x00-0x1F, 0x7F).
  for (let i = 0; i < candidate.length; i++) {
    const code = candidate.charCodeAt(i);
    if (code <= 0x1f || code === 0x7f) return fallback;
  }
  try {
    const base = new URL(origin);
    const parsed = new URL(candidate, base);
    if (parsed.origin !== base.origin) return fallback;
    return parsed.pathname + parsed.search + parsed.hash;
  } catch {
    return fallback;
  }
}

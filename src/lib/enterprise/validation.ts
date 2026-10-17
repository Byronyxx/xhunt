import { z } from 'zod';

// Roles that belong to the organization (tenant) side of the platform.
// 'participant' is the Hunter role and never counts as organization access.
export const ORG_ROLES = ['platform_admin', 'tenant_admin', 'mission_creator', 'analyst'] as const;

export function isOrgRole(role: string | null | undefined): boolean {
  return !!role && (ORG_ROLES as readonly string[]).includes(role);
}

/** Collapse whitespace and normalise unicode so visually identical names compare equal. */
export function normalizeOrgName(raw: string): string {
  return raw.normalize('NFKC').replace(/\s+/g, ' ').trim();
}

/**
 * Comparison key for organization-name uniqueness: case-insensitive, with
 * punctuation ignored ("Acme, Inc." and "ACME Inc" collide).
 */
export function orgNameKey(raw: string): string {
  return normalizeOrgName(raw)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254, 'Email address is too long')
  .pipe(z.email('Enter a valid work email address'));

export const registerSchema = z.object({
  orgName: z
    .string()
    .transform(normalizeOrgName)
    .pipe(
      z
        .string()
        .min(2, 'Organization name must be at least 2 characters')
        .max(120, 'Organization name must be at most 120 characters')
        .refine((v) => orgNameKey(v).length >= 2, 'Organization name must contain letters or numbers'),
    ),
  email: emailSchema,
  // 72 = bcrypt's input limit; longer passwords would be silently truncated.
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(72, 'Password must be at most 72 characters'),
  acceptTerms: z.literal(true, { error: 'You must accept the Terms and Privacy Policy to continue' }),
});

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(256),
  redirectTo: z.string().max(512).optional(),
});

export const emailOnlySchema = z.object({ email: emailSchema });

const ALLOWED_REDIRECTS = [/^\/workspace(\/|$)/, /^\/enterprise(\/|$)/];

/**
 * Accepts only same-site, relative redirect targets inside the enterprise
 * surface. Anything else (absolute URLs, `//host`, backslashes, control
 * characters, other app areas) falls back to `fallback`.
 */
export function safeRedirectPath(input: unknown, fallback = '/workspace'): string {
  if (typeof input !== 'string' || input.length === 0) return fallback;
  if (!input.startsWith('/') || input.startsWith('//')) return fallback;
  if (/[\\\u0000-\u001f\u007f]/.test(input)) return fallback;
  const path = input.split(/[?#]/)[0];
  return ALLOWED_REDIRECTS.some((re) => re.test(path)) ? input : fallback;
}

export function firstIssue(error: z.ZodError): { detail: string; field?: string } {
  const issue = error.issues[0];
  const field = typeof issue?.path?.[0] === 'string' ? (issue.path[0] as string) : undefined;
  return { detail: issue?.message ?? 'Invalid request', field };
}

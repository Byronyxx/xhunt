// Pricing is OFF unless the env var is exactly the string 'true'.
// NEXT_PUBLIC_ vars are inlined at build time, so changing the value needs a rebuild/redeploy.
export const PRICING_ENABLED = process.env.NEXT_PUBLIC_PRICING_ENABLED === 'true';

export function pricingDisabledResponse(): Response {
  return Response.json(
    { error: 'pricing_disabled', message: 'Plans are not available yet.' },
    { status: 403 },
  );
}

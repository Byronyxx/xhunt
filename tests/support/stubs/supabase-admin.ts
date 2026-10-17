export function createAdminClient() {
  return (globalThis as any).__sb.admin;
}

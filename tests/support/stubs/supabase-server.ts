export async function createClient() {
  return (globalThis as any).__sb.server;
}

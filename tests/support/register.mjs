import { register } from 'node:module';
process.env.NEXT_PUBLIC_SUPABASE_URL ??= 'http://localhost:54321';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= 'anon-test';
process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'service-test';
register('./loader.mjs', import.meta.url);

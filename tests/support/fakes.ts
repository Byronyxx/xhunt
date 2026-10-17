// Minimal in-memory fakes for the Supabase clients used by the enterprise routes.
export interface Calls { signOut: number; rpc: Array<[string, unknown]>; inserts: any[]; updates: any[]; signUp: any[]; resend: any[]; reset: any[] }

export function install(opts: {
  signUp?: any; signIn?: any; profile?: any; rpc?: any; registrationByName?: any; registrationByEmail?: any;
  insertError?: any; lookupError?: any; getUserById?: any;
} = {}) {
  const calls: Calls = { signOut: 0, rpc: [], inserts: [], updates: [], signUp: [], resend: [], reset: [] };
  const query = (table: string) => {
    const state: any = { table, filters: {} };
    const q: any = {
      select: () => q,
      eq: (k: string, v: unknown) => { state.filters[k] = v; return q; },
      is: () => q,
      single: async () => ({ data: Array.isArray(opts.profile) ? (opts.profile.length > 1 ? opts.profile.shift() : opts.profile[0]) : (opts.profile ?? null), error: null }),
      maybeSingle: async () => {
        if (opts.lookupError) return { data: null, error: opts.lookupError };
        if ('org_name_key' in state.filters) return { data: opts.registrationByName ?? null, error: null };
        return { data: opts.registrationByEmail ?? null, error: null };
      },
      insert: async (row: any) => { calls.inserts.push({ table, row }); return { error: opts.insertError ?? null }; },
      update: (row: any) => { calls.updates.push({ table, row }); return { eq: async () => ({ error: null }) }; },
    };
    return q;
  };
  const g = globalThis as any;
  g.__sb = {
    server: {
      auth: {
        signUp: async (a: any) => { calls.signUp.push(a); return opts.signUp ?? { data: { user: { id: 'u1', identities: [{}] }, session: null }, error: null }; },
        signInWithPassword: async () => opts.signIn ?? { data: { user: { id: 'u1' }, session: {} }, error: null },
        signOut: async () => { calls.signOut++; return { error: null }; },
        resend: async (a: any) => { calls.resend.push(a); return { error: null }; },
        resetPasswordForEmail: async (e: string, o: any) => { calls.reset.push([e, o]); return { error: null }; },
      },
    },
    admin: {
      from: query,
      rpc: async (name: string, args: unknown) => { calls.rpc.push([name, args]); return opts.rpc ?? { data: null, error: null }; },
      auth: { admin: { getUserById: async () => opts.getUserById ?? { data: { user: { email_confirmed_at: '2026-01-01' } } } } },
    },
  };
  return calls;
}

export const req = (url: string, body: unknown, raw?: string) =>
  new Request(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: raw ?? JSON.stringify(body) });

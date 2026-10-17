'use client';

import Link from 'next/link';
import type { ReactNode, InputHTMLAttributes } from 'react';
import { Building2 } from 'lucide-react';

/** Shared shell for the dedicated Enterprise auth pages (separate from the Hunter pages). */
export function AuthShell({ title, subtitle, children, footer }: {
  title: string; subtitle?: string; children: ReactNode; footer?: ReactNode;
}) {
  return (
    <main className="min-h-screen bg-muted text-txt flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-[440px]">
        <Link href="/enterprise" className="inline-flex items-center gap-2 text-sm text-txt-dim hover:text-txt mb-8">
          <Building2 size={16} className="text-ai" /> X-Hunt Enterprise
        </Link>
        <div className="bg-card border border-border-2 rounded-2xl p-7">
          <h1 className="text-2xl font-bold mb-1">{title}</h1>
          {subtitle && <p className="text-sm text-txt-dim mb-6">{subtitle}</p>}
          {children}
        </div>
        {footer && <div className="mt-5 text-sm text-txt-dim text-center">{footer}</div>}
      </div>
    </main>
  );
}

export function Field({ label, error, ...props }: { label: string; error?: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block mb-4">
      <span className="block text-[13px] font-medium text-txt-dim mb-1.5">{label}</span>
      <input
        {...props}
        className="w-full h-11 px-3.5 rounded-xl bg-surface border border-border-2 text-txt text-[15px] outline-none focus:border-ai"
      />
      {error && <span className="block text-xs text-error mt-1">{error}</span>}
    </label>
  );
}

export function Alert({ kind = 'error', children }: { kind?: 'error' | 'info'; children: ReactNode }) {
  const cls = kind === 'error' ? 'border-error text-error' : 'border-ai text-txt';
  return <div role={kind === 'error' ? 'alert' : 'status'} className={`mb-4 rounded-xl border px-3.5 py-2.5 text-sm ${cls}`}>{children}</div>;
}

export function SubmitButton({ busy, children }: { busy: boolean; children: ReactNode }) {
  return (
    <button
      type="submit"
      disabled={busy}
      className="w-full h-11 rounded-xl bg-ai text-txt font-bold text-[15px] disabled:opacity-60 hover:bg-ai-dark transition-colors"
    >
      {busy ? 'Please wait…' : children}
    </button>
  );
}

export async function postJson(url: string, body: unknown) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data: data as Record<string, string> };
}

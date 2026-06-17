'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth/context';
import { Menu, X } from 'lucide-react';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { createClient } from '@/lib/supabase/client';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isLoaded } = useAuth();
  const [authorized, setAuthorized] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => { setSidebarOpen(false); }, [pathname]);

  useEffect(() => {
    if (!isLoaded) return;
    if (!user) { router.replace('/sign-in?redirect_url=/admin'); return; }

    async function checkAccess() {
      const supabase = createClient();

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('role, tenant_id, onboarding_complete')
        .eq('id', user!.id)
        .single();

      if (!profile?.tenant_id || !profile?.onboarding_complete) {
        router.replace('/get-started');
        return;
      }

      if (profile.role !== 'platform_admin') {
        router.replace('/home');
        return;
      }

      setAuthorized(true);
    }
    checkAccess();
  }, [isLoaded, user, router]);

  if (!authorized) {
    return (
      <div className="min-h-screen bg-[#050816] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="portal-shell portal-shell--admin">
      <AdminSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <div className="portal-main flex flex-col">
        <header className="portal-topbar">
          <button
            onClick={() => setSidebarOpen(v => !v)}
            aria-label="Toggle navigation"
            className="p-2 rounded-lg text-[#8B9CC0] hover:text-[#F0F4FF] hover:bg-[#0A1226] transition-colors"
          >
            {sidebarOpen ? <X size={20} strokeWidth={1.8} /> : <Menu size={20} strokeWidth={1.8} />}
          </button>
          <span className="text-[15px] font-bold text-[#F0F4FF] tracking-tight">Admin</span>
        </header>
        <main className="flex-1 min-w-0 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

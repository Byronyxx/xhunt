'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth/context';
import { Menu, X } from 'lucide-react';
import WorkspaceSidebar from '@/components/workspace/WorkspaceSidebar';
import { createClient } from '@/lib/supabase/client';

interface WorkspaceUser {
  orgName: string;
  plan: string;
  userName: string | null;
  userRole: string;
  avatarUrl: string | null;
}

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isLoaded } = useAuth();
  const [workspaceUser, setWorkspaceUser] = useState<WorkspaceUser | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => { setSidebarOpen(false); }, [pathname]);

  useEffect(() => {
    if (!isLoaded) return;
    if (!user) { router.replace('/sign-in?redirect_url=/workspace'); return; }

    async function boot() {
      const supabase = createClient();

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('role, tenant_id, display_name, avatar_url, onboarding_complete')
        .eq('id', user!.id)
        .single();

      if (!profile?.tenant_id || !profile?.onboarding_complete) {
        router.replace('/get-started');
        return;
      }

      const adminRoles = ['platform_admin', 'tenant_admin', 'mission_creator', 'analyst'];
      if (!adminRoles.includes(profile.role)) {
        router.replace('/home');
        return;
      }

      const { data: tenant } = await supabase
        .from('tenants')
        .select('name, plan')
        .eq('id', profile.tenant_id)
        .single();

      setWorkspaceUser({
        orgName:  tenant?.name ?? 'Your Organization',
        plan:     tenant?.plan ?? 'starter',
        userName: profile.display_name,
        userRole: profile.role,
        avatarUrl: profile.avatar_url,
      });
    }
    boot();
  }, [isLoaded, user, router]);

  if (!workspaceUser) {
    return (
      <div className="min-h-screen bg-[#050816] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          <p className="text-[#4A5578] text-sm font-medium">Loading workspace…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="portal-shell">
      <WorkspaceSidebar
        orgName={workspaceUser.orgName}
        plan={workspaceUser.plan}
        userName={workspaceUser.userName}
        userRole={workspaceUser.userRole}
        avatarUrl={workspaceUser.avatarUrl}
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
          <span className="text-[15px] font-bold text-[#F0F4FF] tracking-tight">Workspace</span>
        </header>
        <main className="flex-1 min-w-0 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

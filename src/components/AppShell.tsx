import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  FileText,
  Boxes,
  RefreshCw,
  AlertTriangle,
  DollarSign,
  Users,
  Search,
  LogOut,
} from "lucide-react";
import type { ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/hooks/use-current-user";
import { ROLE_LABELS, type AppRole } from "@/lib/types";
import { cn } from "@/lib/utils";

interface NavItem {
  to: string;
  label: string;
  icon: typeof FileText;
  roles?: AppRole[];
}

const NAV: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/documents", label: "Documents", icon: FileText },
  { to: "/carts", label: "Carts", icon: Boxes },
  { to: "/retrievals", label: "Retrievals", icon: RefreshCw },
  { to: "/disposal", label: "Disposal Alerts", icon: AlertTriangle },
  { to: "/costs", label: "Cost Management", icon: DollarSign, roles: ["super_admin", "office_services", "dept_head"] },
  { to: "/admin", label: "Admin", icon: Users, roles: ["super_admin"] },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { data: user } = useCurrentUser();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();

  const items = NAV.filter((n) => !n.roles || (user && n.roles.some((r) => user.roles.includes(r))));

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <div className="min-h-screen flex w-full bg-slate-50">
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col">
        <div className="px-5 py-5 border-b border-slate-200">
          <div className="text-xl font-bold text-slate-900">DARMS</div>
          <div className="text-xs text-slate-500 mt-0.5">Document Archival & Retrieval Management System</div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-auto">
          {items.map((item) => {
            const active = pathname === item.to || pathname.startsWith(item.to + "/");
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  active
                    ? "bg-slate-900 text-white"
                    : "text-slate-700 hover:bg-slate-100"
                )}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-slate-200">
          {user && (
            <div className="mb-3">
              <div className="text-sm font-medium text-slate-900 truncate">
                {user.profile.full_name ?? user.email}
              </div>
              <div className="text-xs text-slate-500">{ROLE_LABELS[user.primaryRole]}</div>
              {!user.profile.is_active && (
                <div className="text-xs text-amber-600 mt-1">Pending activation</div>
              )}
            </div>
          )}
          <Button variant="outline" size="sm" className="w-full" onClick={handleSignOut}>
            <LogOut className="w-4 h-4 mr-2" /> Sign out
          </Button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto px-8 py-8">{children}</div>
      </main>
    </div>
  );
}

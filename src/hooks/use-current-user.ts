import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { AppRole, Profile } from "@/lib/types";

export interface CurrentUser {
  userId: string;
  email: string;
  profile: Profile;
  roles: AppRole[];
  primaryRole: AppRole;
}

const ROLE_PRIORITY: AppRole[] = ["super_admin", "office_services", "dept_head", "employee"];

export function useSession() {
  const [userId, setUserId] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUserId(data.session?.user.id ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUserId(session?.user.id ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);
  return userId;
}

export function useCurrentUser() {
  const userId = useSession();
  return useQuery({
    queryKey: ["current-user", userId],
    enabled: !!userId,
    queryFn: async (): Promise<CurrentUser | null> => {
      if (!userId) return null;
      const [{ data: profile, error: pErr }, { data: rolesData, error: rErr }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", userId),
      ]);
      if (pErr) throw pErr;
      if (rErr) throw rErr;
      if (!profile) return null;
      const roles = (rolesData ?? []).map((r) => r.role as AppRole);
      const primaryRole =
        ROLE_PRIORITY.find((r) => roles.includes(r)) ?? ("employee" as AppRole);
      return {
        userId,
        email: profile.email,
        profile: profile as Profile,
        roles,
        primaryRole,
      };
    },
  });
}

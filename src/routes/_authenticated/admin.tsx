import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCurrentUser } from "@/hooks/use-current-user";
import { toast } from "sonner";
import { ROLE_LABELS, type AppRole } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/admin")({
  component: Admin,
});

const ROLES: AppRole[] = ["super_admin", "office_services", "dept_head", "employee"];

function Admin() {
  const { data: user } = useCurrentUser();
  const qc = useQueryClient();
  const isAdmin = user?.roles.includes("super_admin");

  const usersQ = useQuery({
    queryKey: ["all-users"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data: profiles, error } = await supabase
        .from("profiles").select("*, departments(name)").order("created_at", { ascending: false });
      if (error) throw error;
      const { data: roles } = await supabase.from("user_roles").select("user_id, role");
      const map = new Map<string, AppRole[]>();
      (roles ?? []).forEach((r: any) => {
        const a = map.get(r.user_id) ?? [];
        a.push(r.role);
        map.set(r.user_id, a);
      });
      return profiles.map((p: any) => ({ ...p, roles: map.get(p.id) ?? [] }));
    },
  });

  const depsQ = useQuery({
    queryKey: ["departments-admin"],
    queryFn: async () => (await supabase.from("departments").select("*").order("name")).data ?? [],
  });

  const jobsQ = useQuery({
    queryKey: ["job-titles"],
    queryFn: async () => (await supabase.from("job_titles").select("*").order("name")).data ?? [],
  });

  const settingsQ = useQuery({
    queryKey: ["app-settings"],
    enabled: isAdmin,
    queryFn: async () => (await supabase.from("app_settings").select("*").eq("id", true).maybeSingle()).data,
  });

  const [newDept, setNewDept] = useState("");
  const [newJob, setNewJob] = useState("");
  const [providerEmail, setProviderEmail] = useState("");

  useEffect(() => {
    if (settingsQ.data) setProviderEmail((settingsQ.data as any).provider_email ?? "");
  }, [settingsQ.data]);

  if (!isAdmin) {
    return <div className="text-slate-500">Only Super Admins can access this page.</div>;
  }

  const updateProfile = async (id: string, patch: any) => {
    const { error } = await supabase.from("profiles").update(patch).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Updated"); qc.invalidateQueries({ queryKey: ["all-users"] }); }
  };

  const setUserRole = async (userId: string, role: AppRole) => {
    await supabase.from("user_roles").delete().eq("user_id", userId);
    const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
    if (error) toast.error(error.message);
    else { toast.success(`Role set to ${ROLE_LABELS[role]}`); qc.invalidateQueries({ queryKey: ["all-users"] }); }
  };

  const deleteDept = async (id: string, name: string) => {
    if (!confirm(`Delete department "${name}"? Users/carts referencing it may block deletion.`)) return;
    const { error } = await supabase.from("departments").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Department deleted"); qc.invalidateQueries({ queryKey: ["departments-admin"] }); }
  };

  const deleteJob = async (id: string, name: string) => {
    if (!confirm(`Delete role "${name}"?`)) return;
    const { error } = await supabase.from("job_titles").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Role deleted"); qc.invalidateQueries({ queryKey: ["job-titles"] }); }
  };

  const setDeptColor = async (id: string, color: string | null) => {
    const { error } = await supabase.from("departments").update({ theme_color: color }).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Theme color updated"); qc.invalidateQueries({ queryKey: ["departments-admin"] }); qc.invalidateQueries({ queryKey: ["dept-theme"] }); }
  };

  const saveProviderEmail = async () => {
    const email = providerEmail.trim();
    if (email && !/^\S+@\S+\.\S+$/.test(email)) return toast.error("Enter a valid email");
    const { error } = await supabase
      .from("app_settings")
      .update({ provider_email: email || null, updated_at: new Date().toISOString() })
      .eq("id", true);
    if (error) return toast.error(error.message);
    toast.success("Provider email saved");
    qc.invalidateQueries({ queryKey: ["app-settings"] });
  };

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Admin</h1>
        <p className="text-sm text-slate-500">Activate users, assign roles & departments, manage lookups.</p>
      </header>

      <Card className="p-6 mb-6">
        <h2 className="font-semibold text-slate-900 mb-1">Storage provider email</h2>
        <p className="text-xs text-slate-500 mb-3">
          Daily digest of approved carts &amp; normal retrievals is sent to this address at <strong>3:00 PM</strong> (only if there is new activity since the last send).
          Urgent retrievals are emailed immediately with a PDF attachment after approval.
        </p>
        <div className="flex gap-2 max-w-lg">
          <Input type="email" placeholder="provider@example.com" value={providerEmail} onChange={(e) => setProviderEmail(e.target.value)} />
          <Button onClick={saveProviderEmail}>Save</Button>
        </div>
        {settingsQ.data && (settingsQ.data as any).last_daily_sent_at && (
          <p className="text-xs text-slate-500 mt-2">
            Last daily send: {new Date((settingsQ.data as any).last_daily_sent_at).toLocaleString()}
          </p>
        )}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <Card className="p-6">
          <h2 className="font-semibold mb-3">Departments</h2>
          <ul className="space-y-2 text-sm mb-3">
            {depsQ.data?.map((d: any) => (
              <li key={d.id} className="flex items-center justify-between text-slate-700 gap-2">
                <span className="flex items-center gap-2 flex-1 min-w-0">
                  <span
                    className="w-4 h-4 rounded border border-slate-300 shrink-0"
                    style={{ backgroundColor: d.theme_color ?? "transparent" }}
                    title={d.theme_color ?? "Default"}
                  />
                  <span className="truncate">{d.name}</span>
                </span>
                <input
                  type="color"
                  value={d.theme_color ?? "#f8fafc"}
                  onChange={(e) => setDeptColor(d.id, e.target.value)}
                  className="w-8 h-6 border rounded cursor-pointer"
                  title="Pick theme color"
                />
                <label className="inline-flex items-center gap-1 text-xs text-slate-600">
                  <input
                    type="checkbox"
                    checked={!d.theme_color}
                    onChange={(e) => setDeptColor(d.id, e.target.checked ? null : (d.theme_color ?? "#f1f5f9"))}
                  />
                  Default
                </label>
                <button onClick={() => deleteDept(d.id, d.name)} className="text-red-600 hover:text-red-700">
                  <Trash2 className="w-4 h-4" />
                </button>
              </li>
            ))}
          </ul>
          <form className="flex gap-2" onSubmit={async (e) => {
            e.preventDefault();
            if (!newDept) return;
            const { error } = await supabase.from("departments").insert({ name: newDept });
            if (error) return toast.error(error.message);
            setNewDept(""); qc.invalidateQueries({ queryKey: ["departments-admin"] });
          }}>
            <Input value={newDept} onChange={(e) => setNewDept(e.target.value)} placeholder="New department" />
            <Button type="submit">Add</Button>
          </form>
        </Card>

        <Card className="p-6">
          <h2 className="font-semibold mb-3">Roles (Job Titles)</h2>
          <p className="text-xs text-slate-500 mb-2">Shown in the signup form.</p>
          <ul className="space-y-1 text-sm mb-3">
            {jobsQ.data?.map((j: any) => (
              <li key={j.id} className="flex items-center justify-between text-slate-700">
                <span>{j.name}</span>
                <button onClick={() => deleteJob(j.id, j.name)} className="text-red-600 hover:text-red-700">
                  <Trash2 className="w-4 h-4" />
                </button>
              </li>
            ))}
          </ul>
          <form className="flex gap-2" onSubmit={async (e) => {
            e.preventDefault();
            if (!newJob) return;
            const { error } = await supabase.from("job_titles").insert({ name: newJob });
            if (error) return toast.error(error.message);
            setNewJob(""); qc.invalidateQueries({ queryKey: ["job-titles"] });
          }}>
            <Input value={newJob} onChange={(e) => setNewJob(e.target.value)} placeholder="New role" />
            <Button type="submit">Add</Button>
          </form>
        </Card>

        <Card className="p-6">
          <h2 className="font-semibold mb-2">Permission Roles</h2>
          <p className="text-xs text-slate-500 mb-3">System-level access tiers. Assign per user in the table below.</p>
          <ul className="text-sm space-y-1 text-slate-700">
            {ROLES.map((r) => <li key={r}>• {ROLE_LABELS[r]}</li>)}
          </ul>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 font-semibold">Users</div>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-600">
            <tr>
              <th className="text-left px-4 py-2">User</th>
              <th className="text-left px-4 py-2">Department</th>
              <th className="text-left px-4 py-2">Permission Role</th>
              <th className="text-left px-4 py-2">Active</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {usersQ.data?.map((u: any) => (
              <tr key={u.id}>
                <td className="px-4 py-2">
                  <div className="font-medium">{u.full_name ?? u.email}</div>
                  <div className="text-xs text-slate-500">{u.email}{u.job_title ? ` · ${u.job_title}` : ""}</div>
                </td>
                <td className="px-4 py-2">
                  <select className="border border-slate-200 rounded px-2 py-1 text-sm"
                    value={u.department_id ?? ""}
                    onChange={(e) => updateProfile(u.id, { department_id: e.target.value || null })}>
                    <option value="">—</option>
                    {depsQ.data?.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                  <div className="text-xs text-slate-500 mt-1">
                    Current: {u.departments?.name ?? "—"}
                  </div>
                </td>
                <td className="px-4 py-2">
                  <select className="border border-slate-200 rounded px-2 py-1 text-sm"
                    value={u.roles[0] ?? "employee"}
                    onChange={(e) => setUserRole(u.id, e.target.value as AppRole)}>
                    {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                  </select>
                  <div className="text-xs text-slate-500 mt-1">
                    Current: {u.roles.map((r: AppRole) => ROLE_LABELS[r]).join(", ") || "—"}
                  </div>
                </td>
                <td className="px-4 py-2">
                  <label className="inline-flex items-center gap-2">
                    <input type="checkbox" checked={u.is_active}
                      onChange={(e) => updateProfile(u.id, { is_active: e.target.checked })} />
                    <span className="text-xs">{u.is_active ? "Active" : "Inactive"}</span>
                  </label>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

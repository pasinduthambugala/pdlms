import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ROLE_LABELS } from "@/lib/types";

function PwField({ id, value, onChange }: { id: string; value: string; onChange: (v: string) => void }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input id={id} type={show ? "text" : "password"} value={value} onChange={(e) => onChange(e.target.value)} minLength={6} className="pr-10" />
      <button type="button" onClick={() => setShow((s) => !s)} className="absolute inset-y-0 right-2 flex items-center text-slate-500 hover:text-slate-800"
        aria-label={show ? "Hide password" : "Show password"}>
        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [{ title: "My Profile — PDLMS" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const { data: user } = useCurrentUser();
  const qc = useQueryClient();
  const [fullName, setFullName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [pwSaving, setPwSaving] = useState(false);

  const depsQ = useQuery({
    queryKey: ["all-departments"],
    queryFn: async () => (await supabase.from("departments").select("id,name")).data ?? [],
  });
  const jobsQ = useQuery({
    queryKey: ["all-job-titles"],
    queryFn: async () => (await supabase.from("job_titles").select("id,name").order("name")).data ?? [],
  });

  useEffect(() => {
    if (user) {
      setFullName(user.profile.full_name ?? "");
      setJobTitle((user.profile as any).job_title ?? "");
    }
  }, [user]);

  if (!user) return null;

  const deptName = depsQ.data?.find((d: any) => d.id === user.profile.department_id)?.name ?? "—";

  const saveProfile = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: fullName, job_title: jobTitle || null })
      .eq("id", user.userId);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Profile updated");
    qc.invalidateQueries({ queryKey: ["current-user"] });
  };

  const changePassword = async () => {
    if (pw.length < 6) return toast.error("Password must be at least 6 characters");
    if (pw !== pw2) return toast.error("Passwords do not match");
    setPwSaving(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setPwSaving(false);
    if (error) return toast.error(error.message);
    setPw(""); setPw2("");
    toast.success("Password updated");
  };

  return (
    <div className="max-w-2xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">My Profile</h1>
        <p className="text-sm text-slate-500">View and update your account details.</p>
      </header>

      <Card className="p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-xs text-slate-500">Email</Label>
            <div className="text-sm text-slate-900 mt-1">{user.email}</div>
          </div>
          <div>
            <Label className="text-xs text-slate-500">Role</Label>
            <div className="text-sm text-slate-900 mt-1">{ROLE_LABELS[user.primaryRole]}</div>
          </div>
          <div>
            <Label className="text-xs text-slate-500">Department</Label>
            <div className="text-sm text-slate-900 mt-1">{deptName}</div>
          </div>
          <div>
            <Label className="text-xs text-slate-500">Status</Label>
            <div className="text-sm mt-1">{user.profile.is_active ? "Active" : "Pending activation"}</div>
          </div>
        </div>

        <div className="border-t pt-4 space-y-3">
          <div>
            <Label htmlFor="fullName">Full name</Label>
            <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="jobTitle">Job title</Label>
            <select
              id="jobTitle"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm h-9"
            >
              <option value="">Select job title</option>
              {jobsQ.data?.map((j: any) => (
                <option key={j.id} value={j.name}>{j.name}</option>
              ))}
            </select>
          </div>
          <Button onClick={saveProfile} disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </Card>

      <Card className="p-6 space-y-3">
        <h2 className="font-semibold text-slate-900">Change password</h2>
        <div>
          <Label htmlFor="pw">New password</Label>
          <PwField id="pw" value={pw} onChange={setPw} />
        </div>
        <div>
          <Label htmlFor="pw2">Confirm new password</Label>
          <PwField id="pw2" value={pw2} onChange={setPw2} />
        </div>
        <Button onClick={changePassword} disabled={pwSaving || !pw}>
          {pwSaving ? "Updating…" : "Update password"}
        </Button>
      </Card>
    </div>
  );
}

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({ meta: [{ title: "Sign in — PDLMS" }] }),
  component: AuthPage,
});

function AuthPage() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [department, setDepartment] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const depsQ = useQuery({
    queryKey: ["public-departments"],
    queryFn: async () => (await supabase.from("departments").select("id,name").order("name")).data ?? [],
  });
  const jobsQ = useQuery({
    queryKey: ["public-job-titles"],
    queryFn: async () => (await supabase.from("job_titles").select("id,name").order("name")).data ?? [],
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        if (password !== confirmPassword) throw new Error("Passwords do not match");
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: fullName, employee_id: employeeId, department, job_title: jobTitle },
          },
        });
        if (error) throw error;
        toast.success("Account created. Awaiting admin activation if you are not the first user.");
        navigate({ to: "/dashboard" });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/dashboard" });
      }
    } catch (err: any) {
      toast.error(err.message ?? "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <Card className="w-full max-w-md p-8">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-slate-900">PDLMS</h1>
          <p className="text-sm text-slate-500 mt-1">Physical Document Lifecycle Management</p>
        </div>
        <form onSubmit={submit} className="space-y-4">
          {mode === "signup" && (
            <>
              <div>
                <Label htmlFor="name">Full name</Label>
                <Input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
              </div>
              <div>
                <Label htmlFor="employeeId">Employee ID</Label>
                <Input id="employeeId" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} required />
              </div>
              <div>
                <Label htmlFor="department">Department</Label>
                <select id="department" value={department} onChange={(e) => setDepartment(e.target.value)} required className="w-full border rounded p-2">
                  <option value="">Select department</option>
                  {depsQ.data?.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div>
                <Label htmlFor="role">Role</Label>
                <select id="role" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} required className="w-full border rounded p-2">
                  <option value="">Select role</option>
                  {jobsQ.data?.map((j: any) => <option key={j.id} value={j.name}>{j.name}</option>)}
                </select>
              </div>
              <div>
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input id="confirmPassword" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={6} />
              </div>
            </>
          )}
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
          </Button>
        </form>
        <div className="mt-4 text-sm text-center text-slate-600">
          {mode === "signin" ? (
            <>New here?{" "}
              <button type="button" onClick={() => setMode("signup")} className="text-slate-900 font-medium hover:underline">Create an account</button>
            </>
          ) : (
            <>Already have an account?{" "}
              <button type="button" onClick={() => setMode("signin")} className="text-slate-900 font-medium hover:underline">Sign in</button>
            </>
          )}
        </div>
        <p className="text-xs text-slate-400 mt-6 text-center">
          The first user to register becomes the Super Admin automatically.
        </p>
      </Card>
    </div>
  );
}

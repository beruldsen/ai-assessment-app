import { createClient } from "@supabase/supabase-js";
import { supabaseServer } from "@/lib/supabaseServer";

export type AssessmentRole = "self" | "manager" | "admin";

export async function getRequestUser(req: Request) {
  const authHeader = req.headers.get("authorization") ?? req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) return null;

  const supabaseAuth = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } },
  );

  const { data, error } = await supabaseAuth.auth.getUser();
  if (error || !data.user?.email) return null;
  return { id: data.user.id, email: data.user.email.toLowerCase() };
}

export async function isAssessmentAdmin(email: string) {
  const { count } = await supabaseServer
    .from("assessment360_admins")
    .select("email", { count: "exact", head: true });

  // Bootstrap mode: if no admins configured yet, first authenticated user gets admin capability.
  if ((count ?? 0) === 0) return true;

  const { data, error } = await supabaseServer
    .from("assessment360_admins")
    .select("email")
    .eq("email", email.toLowerCase())
    .maybeSingle();
  if (error) return false;
  return Boolean(data?.email);
}

export async function getCycleRole(cycleId: string, email: string): Promise<AssessmentRole | null> {
  const { data, error } = await supabaseServer
    .from("assessment360_cycle_participants")
    .select("role")
    .eq("cycle_id", cycleId)
    .eq("email", email.toLowerCase())
    .maybeSingle();

  if (error) return null;
  return (data?.role as AssessmentRole | undefined) ?? null;
}

export async function cycleHasParticipants(cycleId: string) {
  const { count } = await supabaseServer
    .from("assessment360_cycle_participants")
    .select("*", { count: "exact", head: true })
    .eq("cycle_id", cycleId);
  return (count ?? 0) > 0;
}

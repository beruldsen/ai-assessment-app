export const config = {
  supabaseUrl: process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  openaiApiKey: process.env.OPENAI_API_KEY ?? "",
  workerId: process.env.WORKER_ID ?? "worker-1",
  pollIntervalMs: Number(process.env.POLL_INTERVAL_MS ?? 2000),
};

export function validateConfig() {
  const missing: string[] = [];
  if (!config.supabaseUrl) missing.push("SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL)");
  if (!config.supabaseServiceRoleKey) missing.push("SUPABASE_SERVICE_ROLE_KEY");
  if (!config.openaiApiKey) missing.push("OPENAI_API_KEY");

  if (missing.length) {
    throw new Error(`Missing worker env vars: ${missing.join(", ")}`);
  }
}

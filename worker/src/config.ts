import fs from "node:fs";
import path from "node:path";

function loadEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) return;
  const raw = fs.readFileSync(filePath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

const workerRoot = process.cwd();
loadEnvFile(path.join(workerRoot, ".env"));
loadEnvFile(path.join(workerRoot, ".env.local"));
loadEnvFile(path.join(workerRoot, "..", ".env.local"));

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

import { config, validateConfig } from "./config";
import { supabase } from "./supabase";
import { scoreSimulation } from "./jobs/scoreSimulation";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchPendingJob() {
  const { data, error } = await supabase
    .from("jobs")
    .select("id,type,status,payload,attempts")
    .eq("type", "score_simulation")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

async function tryLock(jobId: string) {
  const { data, error } = await supabase
    .from("jobs")
    .update({
      locked_at: new Date().toISOString(),
      locked_by: config.workerId,
      status: "running",
    })
    .eq("id", jobId)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();

  if (error) throw new Error(error.message);
  return !!data;
}

async function bumpAttempts(jobId: string) {
  const { data, error } = await supabase
    .from("jobs")
    .select("attempts")
    .eq("id", jobId)
    .single();

  if (error) throw new Error(error.message);

  const attempts = (data.attempts ?? 0) + 1;
  const { error: upErr } = await supabase.from("jobs").update({ attempts }).eq("id", jobId);
  if (upErr) throw new Error(upErr.message);

  return attempts;
}

async function completeJob(jobId: string, result: unknown) {
  const { error } = await supabase
    .from("jobs")
    .update({
      status: "completed",
      result,
      last_error: null,
      locked_at: null,
      locked_by: null,
    })
    .eq("id", jobId);

  if (error) throw new Error(error.message);
}

async function failJob(jobId: string, attempts: number, err: string) {
  const finalStatus = attempts >= 3 ? "failed" : "pending";
  const { error } = await supabase
    .from("jobs")
    .update({
      status: finalStatus,
      last_error: err.slice(0, 2000),
      locked_at: null,
      locked_by: null,
    })
    .eq("id", jobId);

  if (error) throw new Error(error.message);
}

async function main() {
  validateConfig();
  console.log(`[worker] started as ${config.workerId}`);

  while (true) {
    try {
      const job = await fetchPendingJob();
      if (!job) {
        await sleep(config.pollIntervalMs);
        continue;
      }

      const locked = await tryLock(job.id);
      if (!locked) {
        await sleep(300);
        continue;
      }

      const attempts = await bumpAttempts(job.id);

      try {
        const payload = (job.payload ?? {}) as { attemptId?: string; orgId?: string | null };
        if (!payload.attemptId) throw new Error("Missing payload.attemptId");

        const result = await scoreSimulation({ attemptId: payload.attemptId, orgId: payload.orgId ?? null });
        await completeJob(job.id, result);
        console.log(`[worker] job ${job.id} completed`);
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        await failJob(job.id, attempts, message);
        console.error(`[worker] job ${job.id} failed: ${message}`);
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      console.error(`[worker] loop error: ${message}`);
      await sleep(config.pollIntervalMs);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

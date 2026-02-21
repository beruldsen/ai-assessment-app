/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

function loadEnv(path) {
  const env = {};
  const text = fs.readFileSync(path, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) env[m[1].trim()] = m[2].trim();
  }
  return env;
}

async function run() {
  const env = loadEnv('.env.local');
  const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

  const scenarioId = '87681de0-96b3-4e47-aafb-5b0c4ecbd14a';
  const startRes = await fetch('http://localhost:3000/api/simulations/start', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ scenarioId }),
  });
  const startJson = await startRes.json();
  console.log('start', startRes.status, startJson);

  const endRes = await fetch(`http://localhost:3000/api/simulations/${startJson.attemptId}/end`, {
    method: 'POST',
  });
  const endJson = await endRes.json();
  console.log('end', endRes.status, endJson);

  const latestJob = await sb
    .from('jobs')
    .select('id,type,status,payload,created_at')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  console.log('job', latestJob.data, latestJob.error?.message || null);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});

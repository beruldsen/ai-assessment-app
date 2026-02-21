/* eslint-disable @typescript-eslint/no-require-imports */
const { createClient } = require('@supabase/supabase-js');

async function run() {
  const base = 'http://localhost:3000';
  const scenarioId = '87681de0-96b3-4e47-aafb-5b0c4ecbd14a';

  const start = await fetch(`${base}/api/simulations/start`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ scenarioId }),
  });
  const sText = await start.text();
  console.log('start', start.status, sText);
  if (!start.ok) return;

  const { attemptId } = JSON.parse(sText);

  const msg = await fetch(`${base}/api/simulations/${attemptId}/message`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ content: 'Testing ROI message' }),
  });
  const mText = await msg.text();
  console.log('message', msg.status, mText);

  const end = await fetch(`${base}/api/simulations/${attemptId}/end`, {
    method: 'POST',
  });
  const eText = await end.text();
  console.log('end', end.status, eText);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const sb = createClient(url, key);

  const attempt = await sb
    .from('simulation_attempts')
    .select('id,status,scenario_id')
    .eq('id', attemptId)
    .single();

  const messages = await sb
    .from('simulation_messages')
    .select('id,sender,content')
    .eq('attempt_id', attemptId)
    .order('created_at', { ascending: true });

  console.log('attemptRow', JSON.stringify(attempt.data));
  console.log('messages', messages.data?.length, JSON.stringify(messages.data));
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
